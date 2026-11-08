# Genera el cuerpo 3D de Ferro (public/modelos/cuerpo.glb) a partir de Z-Anatomy.
#
# Uso (Blender 4.5 LTS, sin ventana y sin ejecutar los scripts que trae el .blend):
#   blender --background --factory-startup --disable-autoexec Startup.blend \
#           --python scripts/blender/generar-cuerpo.py -- public/modelos/cuerpo.glb [prefijo_capturas]
#
# Fuente: Z-Anatomy (https://github.com/Z-Anatomy/The-blend, CC BY-SA 4.0), basado en BodyParts3D
# (The Database Center for Life Science, CC BY-SA 2.1 Japón). El modelo resultante se distribuye con la
# misma licencia CC BY-SA 4.0 (ver Ajustes → Créditos).
#
# Pasos:
#   1. Piel: las regiones de la piel (sin pelo ni genitales: es un maniquí) se unen y se convierten en un
#      volumen cerrado con un remallado por vóxeles.
#   2. Definición: donde hay músculo debajo, la piel se hunde hasta él (se quita la grasa del modelo
#      original) y se une con los músculos superficiales, inflados (más en brazos, hombros, pecho,
#      glúteos y piernas). Así se marcan los músculos y el cuerpo tiene volumen.
#   3. Se suaviza (acabado de arcilla), se simplifica para el móvil y cada cara se asigna a la región de
#      Ferro del músculo más cercano (pectoral superior, bíceps, cuádriceps…).
#   4. Se hornea la oclusión ambiental en los vértices y se exporta un GLB comprimido con Draco.
#      COLOR_0 lleva en R el número de región (id / 255) y en G la oclusión ambiental.

import bpy, bmesh, sys, os, math, json
from collections import Counter, defaultdict
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SALIDA = ARGS[0] if ARGS else 'cuerpo.glb'
CAPTURAS = ARGS[1] if len(ARGS) > 1 else None

# ── Parámetros ─────────────────────────────────────────────────────────────────────────────
VOXEL_PIEL = 0.004       # remallado de la piel original (m)
VOXEL = 0.003            # remallado final (m)
CERCA = 0.035            # la piel a menos de esto de un músculo se hunde hasta él (se quita la grasa)
LEJOS = 0.055            # a partir de aquí la piel no se toca
HUNDIR_MAX = 0.03        # como mucho se hunde esto
# Cuánto se inflan los músculos de cada región antes de unirlos a la piel (m): da volumen y redondea
# los surcos entre músculos (sin esto parece un modelo anatómico sin grasa).
INFLAR_REGION = {
    'pectoral_superior': 0.015, 'pectoral_inferior': 0.015, 'deltoides_anterior': 0.015,
    'deltoides_lateral': 0.015, 'deltoides_posterior': 0.014, 'biceps': 0.014, 'braquial': 0.013,
    'triceps': 0.014, 'antebrazos': 0.009, 'trapecio': 0.012, 'espalda_media': 0.012, 'dorsales': 0.012,
    'lumbares': 0.010, 'abdomen': 0.009, 'oblicuos': 0.010, 'gluteo_mayor': 0.014, 'gluteo_medio': 0.012,
    'cuadriceps': 0.014, 'isquiotibiales': 0.014, 'aductores': 0.012, 'gemelos': 0.010, 'soleo': 0.010,
    'cuello': 0.010,
}
INFLAR_SIN_REGION = 0.009 # músculos que solo dan forma (serratos, intercostales…)
HUNDIR_EXTRA = 0.001     # la piel queda justo por debajo de los músculos inflados
SUAVIZADO = (1.0, 10)    # (factor, repeticiones) del suavizado final
SUAVIZAR_HUNDIDO = 10    # pasadas de suavizado del hundimiento (evita hoyos y picos)
SUAVIZAR_PROTECCION = 30 # pasadas para que las zonas protegidas pasen a las demás sin escalón
CIERRE = 0.0025          # cierre morfológico: tapa grietas y hoyos de menos de 2 × esto
CARAS_OBJETIVO = 110_000 # triángulos del modelo final
PUNTOS_REJILLA = 0.03        # separación de los puntos de la superficie para los choques (m)
PROFUNDIDAD_REGION = 0.05 # se busca el músculo hacia dentro hasta esta profundidad
# Algunos músculos quedan bajo la aponeurosis de otro (el recto bajo la del oblicuo externo, los
# lumbares bajo la del dorsal ancho): para elegir la región se les da esta ventaja (m).
VENTAJA_REGION = {'abdomen': 0.012, 'lumbares': 0.025, 'gluteo_mayor': 0.006, 'aductores': 0.003, 'soleo': 0.010}

# Regiones de Ferro (el índice es el id que va en el modelo; 0 = sin músculo de Ferro).
REGIONES = [
    None, 'pectoral_superior', 'pectoral_inferior', 'deltoides_anterior', 'deltoides_lateral',
    'deltoides_posterior', 'biceps', 'braquial', 'triceps', 'antebrazos', 'trapecio', 'espalda_media',
    'dorsales', 'lumbares', 'abdomen', 'oblicuos', 'gluteo_mayor', 'gluteo_medio', 'cuadriceps',
    'isquiotibiales', 'aductores', 'gemelos', 'soleo', 'cuello',
]

# Músculos de Z-Anatomy que dan forma al cuerpo y región de Ferro de cada uno (None: solo forma).
# Las correspondencias siguen las del mapa 2D (src/domain/avatar.ts): el trapecio de Ferro es la
# porción descendente; la espalda media, el trapecio medio e inferior, romboides y manguito posterior.
MUSCULOS = {
    'Clavicular head of pectoralis major muscle': 'pectoral_superior',
    'Sternocostal head of pectoralis major muscle': 'pectoral_inferior',
    'Abdominal part of pectoralis major muscle': 'pectoral_inferior',
    'Clavicular part of deltoid muscle': 'deltoides_anterior',
    'Acromial part of deltoid muscle': 'deltoides_lateral',
    'Scapular spinal part of deltoid muscle': 'deltoides_posterior',
    'Long head of biceps brachii': 'biceps',
    'Short head of biceps brachii': 'biceps',
    'Brachialis muscle': 'braquial',
    'Coracobrachialis muscle': None,
    'Long head of triceps brachii': 'triceps',
    'Lateral head of triceps brachii': 'triceps',
    'Medial head of triceps brachii': 'triceps',
    'Anconeus muscle': 'triceps',
    'Brachioradialis muscle': 'antebrazos',
    'Flexor carpi radialis': 'antebrazos',
    'Palmaris longus muscle': 'antebrazos',
    'Humeral head of flexor carpi ulnaris': 'antebrazos',
    'Ulnar head of flexor carpi ulnaris': 'antebrazos',
    'Humero-ulnar head of flexor digitorum superficialis': 'antebrazos',
    'Radial head of flexor digitorum superficialis': 'antebrazos',
    'Superficial head of pronator teres': 'antebrazos',
    'Deep head of pronator teres': 'antebrazos',
    'Extensor carpi radialis longus': 'antebrazos',
    'Extensor carpi radialis brevis': 'antebrazos',
    'Extensor digitorum': 'antebrazos',
    'Extensor digiti minimi': 'antebrazos',
    'Humeral head of extensor carpi ulnaris': 'antebrazos',
    'Ulnar head of extensor carpi ulnaris': 'antebrazos',
    'Abductor pollicis longus': 'antebrazos',
    'Extensor pollicis brevis': 'antebrazos',
    'Extensor pollicis longus': 'antebrazos',
    'Flexor digitorum profundus': 'antebrazos',
    'Flexor pollicis longus': 'antebrazos',
    'Supinator': 'antebrazos',
    # En Z-Anatomy la pieza llamada «Ascending part» es la de arriba (junto al cuello, z ≈ 1,48 m) y la
    # «Descending part» la de abajo (z ≈ 1,31 m): se asignan por su posición real.
    'Ascending part of trapezius muscle': 'trapecio',
    'Transverse part of trapezius muscle': 'espalda_media',
    'Descending part of trapezius muscle': 'espalda_media',
    'Rhomboid major muscle': 'espalda_media',
    'Rhomboid minor muscle': 'espalda_media',
    'Infraspinatus muscle': 'espalda_media',
    'Teres minor muscle': 'espalda_media',
    'Teres major muscle': 'espalda_media',
    'Supraspinatus muscle': None,
    'Latissimus dorsi muscle': 'dorsales',
    'Iliocostalis lumborum muscle': 'lumbares',
    'Iliocostalis thoracis muscle': None,
    'Longissimus thoracis muscle': 'lumbares',
    'Spinalis thoracis muscle': None,
    'Multifidus lumborum muscle': 'lumbares',
    'Rectus abdominis muscle': 'abdomen',
    'Pyramidalis muscle': 'abdomen',
    'External abdominal oblique muscle': 'oblicuos',
    'Serratus anterior muscle': None,
    'Gluteus maximus muscle': 'gluteo_mayor',
    'Gluteus medius muscle': 'gluteo_medio',
    'Tensor fasciae latae': 'gluteo_medio',
    'Rectus femoris muscle': 'cuadriceps',
    'Vastus lateralis muscle': 'cuadriceps',
    'Vastus medialis muscle': 'cuadriceps',
    'Vastus intermedius muscle': 'cuadriceps',
    'Long head of biceps femoris': 'isquiotibiales',
    'Short head of biceps femoris': 'isquiotibiales',
    'Semitendinosus muscle': 'isquiotibiales',
    'Semimembranosus muscle': 'isquiotibiales',
    'Adductor longus': 'aductores',
    'Adductor brevis': 'aductores',
    'Adductor magnus': 'aductores',
    'Gracilis muscle': 'aductores',
    'Pectineus muscle': 'aductores',
    'Sartorius muscle': None,
    'Medial head of gastrocnemius': 'gemelos',
    'Lateral head of gastrocnemius': 'gemelos',
    'Soleus muscle': 'soleo',
    'Tibialis anterior muscle': None,
    'Extensor digitorum longus': None,
    'Extensor hallucis longus': None,
    'Fibularis longus muscle': None,
    'Fibularis brevis muscle': None,
    'Iliotibial tract': None,
    'Calcaneal tendon': None,
    'Sternocleidomastoid muscle': 'cuello',
    'Splenius capitis muscle': 'cuello',
    'Levator scapulae': 'cuello',
    'Scalenus anterior muscle': 'cuello',
    'Scalenus medius muscle': 'cuello',
    'Scalenus posterior muscle': 'cuello',
    'Sternohyoid muscle': 'cuello',
    'Omohyoid muscle': 'cuello',
}

# Algunas regiones solo existen a cierta altura (m, en el modelo de pie): los erectores suben hasta el
# cuello, pero los «lumbares» de Ferro son la zona baja de la espalda.
ALTURA_REGION = {'lumbares': (0.0, 1.16)}

# Piezas de piel que no lleva un maniquí.
FUERA_DE_LA_PIEL = ('Hairs of head', 'Hairs of eyebrow', 'Pubic hairs', 'Urogenital region', 'Eyelashes')

# Zonas de piel que se quedan como están (sin músculo de Ferro debajo, o con hueso o tendones justo
# bajo la piel): cabeza, manos, muñecas, rodillas, espinillas, tobillos y pies.
PIEL_PROTEGIDA = (
    'digits of hand', 'Palm', 'Dorsum of hand', 'Nail plate', 'Perionyx', 'region of wrist', 'Radial foveola',
    'region of knee', 'Popliteal fossa', 'Anterior region of leg', 'malleol', 'region of ankle', 'foot', 'Sole',
    'Heel', 'Hallucial', 'Metatarsal',
    'Mental', 'Oral', 'Buccal', 'lip', 'Philtrum', 'Nasal', 'Nasolabial', 'Labial', 'Angle of mouth',
    'Parotideomasseteric', 'auricle', 'Auricular', 'Tragus', 'Antitragus', 'Intertragic', 'concha', 'Concha',
    'Antihelix', 'antihelix', 'Helix', 'Scapha', 'scaphae', 'Triangular fossa', 'fossae triangularis',
    'Mastoid', 'Occipital', 'Parietal', 'Temporal', 'Frontal', 'Orbital', 'Infra-orbital', 'Zygomatic',
    'Eyebrow', 'Submental', 'Submandibular',
)


# Zonas donde la piel se hunde menos (glúteos, sacro, cadera…): en el modelo original hay mucha grasa
# y hueso cerca, y hundirla del todo deja formas raras.
HUNDIR_PARCIAL = {
    'Gluteal region': 0.35, 'Sacral region': 0.15, 'Hip region': 0.45, 'Lumbar region': 0.7,
    'Hypogastric region': 0.75, 'Inguinal region': 0.6, 'Femoral triangle': 0.6, 'Gluteal fold': 0.3,
    'Anal region': 0.0, 'Posterior region of elbow': 0.5, 'Vertebral region': 0.6,
}


def factor_hundir(nombre):
    if any(p in nombre for p in PIEL_PROTEGIDA):
        return 0.0
    return HUNDIR_PARCIAL.get(nombre, 1.0)


def base(nombre):
    """'(Abdominal part of pectoralis major muscle).l' → 'Abdominal part of pectoralis major muscle'."""
    n = nombre
    if n.endswith('.l') or n.endswith('.r'):
        n = n[:-2]
    return n.strip('()')


def con_caras(coleccion):
    # Los objetos '.g' son etiquetas de grupo (texto), no anatomía.
    return [o for o in bpy.data.collections[coleccion].all_objects
            if o.type == 'MESH' and len(o.data.polygons) > 0 and not o.name.endswith('.g')]


def a_bmesh(objetos, capa_entera=None, valor=None):
    """Une objetos en un bmesh en coordenadas del mundo, con las caras bien orientadas (los del lado
    izquierdo son espejos con escala negativa). Opcionalmente guarda un entero por cara."""
    bm = bmesh.new()
    capa = bm.faces.layers.int.new(capa_entera) if capa_entera else None
    for o in objetos:
        tmp = bmesh.new(); tmp.from_mesh(o.data); tmp.transform(o.matrix_world)
        if o.matrix_world.determinant() < 0:
            bmesh.ops.reverse_faces(tmp, faces=tmp.faces)
        if capa_entera:
            c = tmp.faces.layers.int.new(capa_entera)
            v = valor(o)
            for f in tmp.faces:
                f[c] = v
        me = bpy.data.meshes.new('tmp'); tmp.to_mesh(me); tmp.free()
        bm.from_mesh(me); bpy.data.meshes.remove(me)
    return bm


def objeto(bm, nombre):
    me = bpy.data.meshes.new(nombre); bm.to_mesh(me)
    ob = bpy.data.objects.new(nombre, me); bpy.context.scene.collection.objects.link(ob)
    return ob


def aplicar(ob, tipo, **ajustes):
    m = ob.modifiers.new(tipo.lower(), tipo)
    for k, v in ajustes.items():
        setattr(m, k, v)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.modifier_apply(modifier=m.name)


def quedarse_con_la_isla_mayor(ob):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    isla = [-1] * len(bm.verts); n = 0; tamanos = []
    for v in bm.verts:
        if isla[v.index] >= 0:
            continue
        pila = [v]; t = 0
        while pila:
            x = pila.pop()
            if isla[x.index] >= 0:
                continue
            isla[x.index] = n; t += 1
            pila.extend(e.other_vert(x) for e in x.link_edges if isla[e.other_vert(x).index] < 0)
        tamanos.append(t); n += 1
    mayor = max(range(n), key=lambda i: tamanos[i])
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if isla[v.index] != mayor], context='VERTS')
    bm.to_mesh(ob.data); bm.free()
    print(f'  islas: {n}, se conserva la mayor ({tamanos[mayor]} vértices)')


def paso(texto):
    print(f'[cuerpo] {texto}', flush=True)


# ── 1. Piel cerrada ────────────────────────────────────────────────────────────────────────
paso('piel')
piel_objs = [o for o in con_caras('9: Regions of human body') if not base(o.name).startswith(FUERA_DE_LA_PIEL)]
bm = a_bmesh(piel_objs, 'factor', lambda o: round(100 * factor_hundir(base(o.name))))
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
bmesh.ops.holes_fill(bm, edges=bm.edges, sides=0)
bm.faces.ensure_lookup_table()
capa_p = bm.faces.layers.int['factor']
factor_de_cara = [f[capa_p] / 100 for f in bm.faces]
arbol_piel = BVHTree.FromBMesh(bm)
def factor_en(co):
    loc, nor, i, d = arbol_piel.find_nearest(co)
    return factor_de_cara[i] if loc is not None else 1.0
piel = objeto(bm, 'piel'); bm.free()
aplicar(piel, 'REMESH', mode='VOXEL', voxel_size=VOXEL_PIEL)
quedarse_con_la_isla_mayor(piel)
aplicar(piel, 'SMOOTH', factor=0.5, iterations=2)

# ── 2. Músculos y piel hundida ────────────────────────────────────────────────────────────
paso('músculos')
musc_objs = [o for o in con_caras('4: Muscular system') if base(o.name) in MUSCULOS]
faltan = set(MUSCULOS) - {base(o.name) for o in musc_objs}
if faltan:
    print('  AVISO: no encontrados', sorted(faltan))
id_region = {r: i for i, r in enumerate(REGIONES)}
bm_m = a_bmesh(musc_objs, 'region', lambda o: id_region[MUSCULOS[base(o.name)]])
bmesh.ops.recalc_face_normals(bm_m, faces=bm_m.faces)
bm_m.faces.ensure_lookup_table()
capa_m = bm_m.faces.layers.int['region']
region_de_cara = [f[capa_m] for f in bm_m.faces]
arbol_m = BVHTree.FromBMesh(bm_m)
print(f'  {len(musc_objs)} objetos, {len(bm_m.faces)} caras')

# Caché opcional (FERRO_CACHE=ruta.blend): guarda el cuerpo ya simplificado para repetir solo los
# pasos de regiones y exportación mientras se ajustan.
CACHE = os.environ.get('FERRO_CACHE')
if CACHE and os.path.exists(CACHE):
    paso('cuerpo desde la caché')
    with bpy.data.libraries.load(CACHE) as (origen, destino):
        destino.meshes = ['cuerpo']
    cuerpo = bpy.data.objects.new('cuerpo', destino.meshes[0]); bpy.context.scene.collection.objects.link(cuerpo)
    bpy.data.objects.remove(piel)
else:
    paso('hundir la piel sobre los músculos')
    inflar_cara = [INFLAR_REGION.get(REGIONES[r], INFLAR_SIN_REGION) if r else INFLAR_SIN_REGION for r in region_de_cara]
    from mathutils.kdtree import KDTree
    bm = bmesh.new(); bm.from_mesh(piel.data)
    bm.verts.ensure_lookup_table(); bm.normal_update()
    vecinos_v = [[e.other_vert(v).index for e in v.link_edges] for v in bm.verts]

    def suavizar(valores, pasadas):
        for _ in range(pasadas):
            nuevo = valores[:]
            for i, vec in enumerate(vecinos_v):
                if vec:
                    nuevo[i] = 0.5 * valores[i] + 0.5 * sum(valores[j] for j in vec) / len(vec)
            valores = nuevo
        return valores

    # Protección gradual: 1 dentro de manos, pies, cabeza…, y baja poco a poco al salir de ellas.
    proteccion = suavizar([1.0 - factor_en(v.co) for v in bm.verts], SUAVIZAR_PROTECCION)
    hundir = []
    for v in bm.verts:
        loc, nor, i, d = arbol_m.find_nearest(v.co, LEJOS)
        if loc is None:
            hundir.append(0.0); continue
        t = 1.0 if d <= CERCA else 1.0 - (d - CERCA) / (LEJOS - CERCA)
        t = t * t * (3 - 2 * t)
        profundidad = (v.co - loc).dot(v.normal)
        hundir.append(t * min(HUNDIR_MAX, max(0.0, profundidad - inflar_cara[i] + HUNDIR_EXTRA)))
    hundir = suavizar(hundir, SUAVIZAR_HUNDIDO)
    for v in bm.verts:
        v.co -= v.normal * hundir[v.index] * (1.0 - min(1.0, proteccion[v.index]))
    arbol_proteccion = KDTree(len(bm.verts))
    for v in bm.verts:
        arbol_proteccion.insert(v.co, v.index)
    arbol_proteccion.balance()
    bm.to_mesh(piel.data); bm.free()

    paso('unir piel y músculos')
    bm_inflado = bm_m.copy()
    bm_inflado.normal_update()
    bm_inflado.faces.ensure_lookup_table()
    for v in bm_inflado.verts:
        # Dentro de manos, pies, rodillas… los tendones no se inflan: así no asoman por la piel.
        co, j, _ = arbol_proteccion.find(v.co)
        inflar = sum(inflar_cara[f.index] for f in v.link_faces) / max(1, len(v.link_faces))
        v.co += v.normal * inflar * (1.0 - min(1.0, proteccion[j]))
    bm_union = bmesh.new(); bm_union.from_mesh(piel.data)
    me = bpy.data.meshes.new('tmp'); bm_inflado.to_mesh(me); bm_union.from_mesh(me); bpy.data.meshes.remove(me)
    bm_inflado.free()
    cuerpo = objeto(bm_union, 'cuerpo'); bm_union.free()
    bpy.data.objects.remove(piel)
    aplicar(cuerpo, 'REMESH', mode='VOXEL', voxel_size=VOXEL)
    quedarse_con_la_isla_mayor(cuerpo)
    paso(f'  remallado: {len(cuerpo.data.polygons)} caras')

    paso('cierre: tapar grietas y hoyos pequeños')
    def desplazar(ob, distancia):
        bm = bmesh.new(); bm.from_mesh(ob.data); bm.normal_update()
        for v in bm.verts:
            v.co += v.normal * distancia
        bm.to_mesh(ob.data); bm.free()
    desplazar(cuerpo, CIERRE)
    aplicar(cuerpo, 'REMESH', mode='VOXEL', voxel_size=VOXEL)
    desplazar(cuerpo, -CIERRE)
    aplicar(cuerpo, 'REMESH', mode='VOXEL', voxel_size=VOXEL)
    quedarse_con_la_isla_mayor(cuerpo)

    # ── 3. Acabado, simplificación y regiones ──────────────────────────────────────────────────
    paso('suavizar y simplificar')
    aplicar(cuerpo, 'LAPLACIANSMOOTH', lambda_factor=SUAVIZADO[0], iterations=SUAVIZADO[1], use_volume_preserve=True, use_normalized=True)
    aplicar(cuerpo, 'DECIMATE', decimate_type='COLLAPSE', ratio=min(1.0, CARAS_OBJETIVO / (2 * len(cuerpo.data.polygons))), use_symmetry=True, symmetry_axis='X')
    aplicar(cuerpo, 'TRIANGULATE')
    paso(f'  {len(cuerpo.data.polygons)} triángulos')

    # La simplificación deja algún triángulo dado la vuelta (se ve como un puntito negro): sus vértices se
    # llevan a la media de sus vecinos hasta que no quede ninguno.
    bm = bmesh.new(); bm.from_mesh(cuerpo.data)
    for pasada in range(20):
        bm.normal_update()
        volteadas = [f for f in bm.faces
                     if sum(1 for e in f.edges for g in e.link_faces if g is not f and g.normal.dot(f.normal) < -0.2) >= 2]
        if not volteadas:
            break
        for v in {v for f in volteadas for v in f.verts}:
            vec = [e.other_vert(v).co for e in v.link_edges]
            v.co = sum(vec, Vector()) / len(vec)
    print(f'  triángulos dados la vuelta corregidos en {pasada} pasadas; quedan {len(volteadas)}')
    bm.to_mesh(cuerpo.data); bm.free()
    if CACHE:
        cuerpo.data.name = 'cuerpo'
        bpy.data.libraries.write(CACHE, {cuerpo.data})

paso('regiones')
bm = bmesh.new(); bm.from_mesh(cuerpo.data)
bm.faces.ensure_lookup_table(); bm.normal_update()
arboles = {}
for rid in sorted(set(region_de_cara)):
    sub = bm_m.copy()
    capa_s = sub.faces.layers.int['region']
    bmesh.ops.delete(sub, geom=[f for f in sub.faces if f[capa_s] != rid], context='FACES')
    arboles[rid] = (BVHTree.FromBMesh(sub), VENTAJA_REGION.get(REGIONES[rid], 0.0) if rid else 0.0)
    sub.free()
region = []
for f in bm.faces:
    c = f.calc_center_median()
    # Manos, pies, cabeza, rodillas… no son ningún músculo de Ferro.
    if factor_en(c) < 0.3:
        region.append(0); continue
    # El primer músculo que se encuentra hacia dentro (como al cortar con un bisturí). Si el rayo no
    # da con ninguno (bordes), el más cercano.
    origen = c + f.normal * 0.004
    mejor, mejor_puntos = 0, None
    for rid, (arbol, ventaja) in arboles.items():
        alto = ALTURA_REGION.get(REGIONES[rid]) if rid else None
        if alto and not (alto[0] <= c.z <= alto[1]):
            continue
        loc, nor, i, t = arbol.ray_cast(origen, -f.normal, PROFUNDIDAD_REGION)
        if loc is not None:
            puntos = t - ventaja
        else:
            loc, nor, i, d = arbol.find_nearest(c, 0.025)
            if loc is None:
                continue
            puntos = d + 0.015 - ventaja
        if mejor_puntos is None or puntos < mejor_puntos:
            mejor, mejor_puntos = rid, puntos
    region.append(mejor)
# Bordes limpios: cada cara toma la región de la mayoría de sus vecinas.
vecinas = [[g.index for e in f.edges for g in e.link_faces if g is not f] for f in bm.faces]
for _ in range(5):
    nueva = region[:]
    for f in bm.faces:
        c = Counter(region[j] for j in vecinas[f.index])
        r, n = c.most_common(1)[0]
        if r != region[f.index] and n >= 2:
            nueva[f.index] = r
    region = nueva
# Islas muy pequeñas de una región: se quitan.
visto = [False] * len(bm.faces)
for f in bm.faces:
    if visto[f.index]:
        continue
    pila, isla = [f.index], []
    while pila:
        j = pila.pop()
        if visto[j]:
            continue
        visto[j] = True; isla.append(j)
        pila.extend(k for k in vecinas[j] if not visto[k] and region[k] == region[j])
    if len(isla) < 120 and region[f.index] != 0:
        alrededor = Counter(region[k] for j in isla for k in vecinas[j] if region[k] != region[f.index])
        destino = alrededor.most_common(1)[0][0] if alrededor else 0
        for j in isla:
            region[j] = destino
bm.to_mesh(cuerpo.data); bm.free()
for p in cuerpo.data.polygons:
    p.use_smooth = True
pequenas = 0
visto = [False] * len(region)
for i0 in range(len(region)):
    if visto[i0]:
        continue
    pila, n = [i0], 0
    while pila:
        j = pila.pop()
        if visto[j]:
            continue
        visto[j] = True; n += 1
        pila.extend(k for k in vecinas[j] if not visto[k] and region[k] == region[j])
    pequenas += n < 120
print(f'  islas de menos de 120 caras tras limpiar: {pequenas}')
recuento = Counter(region)
print('  caras por región:', {REGIONES[k] or 'ninguna': v for k, v in sorted(recuento.items())})

# ── 4. Oclusión ambiental horneada y colores ───────────────────────────────────────────────
paso('oclusión ambiental')
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 64
if sc.world is None:
    sc.world = bpy.data.worlds.new('mundo')
sc.world.light_settings.distance = 0.12
mat = bpy.data.materials.new('arcilla'); mat.use_nodes = True
cuerpo.data.materials.clear(); cuerpo.data.materials.append(mat)
ao = cuerpo.data.color_attributes.new('ao', 'FLOAT_COLOR', 'POINT')
cuerpo.data.color_attributes.active_color = ao
for o in list(sc.objects):
    if o is not cuerpo:
        o.hide_render = True
bpy.ops.object.select_all(action='DESELECT')
bpy.context.view_layer.objects.active = cuerpo; cuerpo.select_set(True)
bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')

datos = cuerpo.data.color_attributes.new('datos', 'FLOAT_COLOR', 'CORNER')
for p in cuerpo.data.polygons:
    r = region[p.index] / 255.0
    for li, vi in zip(p.loop_indices, p.vertices):
        a = ao.data[vi].color[0]
        datos.data[li].color = (r, a, 0.0, 1.0)
cuerpo.data.color_attributes.remove(ao)
cuerpo.data.color_attributes.active_color = cuerpo.data.color_attributes['datos']
cuerpo.data.materials.clear()

# El cuerpo, de pie sobre el suelo y centrado.
xs = [v.co for v in cuerpo.data.vertices]
minz = min(v.z for v in xs)
cx = (min(v.x for v in xs) + max(v.x for v in xs)) / 2
cy = (min(v.y for v in xs) + max(v.y for v in xs)) / 2
cuerpo.data.transform(Matrix.Translation((-cx, -cy, -minz)))

# ── 5. Exportar ────────────────────────────────────────────────────────────────────────────
paso('exportar')
bpy.ops.object.select_all(action='DESELECT')
cuerpo.hide_set(False); cuerpo.select_set(True); bpy.context.view_layer.objects.active = cuerpo
os.makedirs(os.path.dirname(os.path.abspath(SALIDA)), exist_ok=True)
opciones = dict(
    filepath=os.path.abspath(SALIDA), export_format='GLB', use_selection=True, export_yup=True,
    export_apply=True, export_normals=True, export_texcoords=False, export_materials='NONE',
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
    export_draco_position_quantization=14, export_draco_normal_quantization=10,
    export_draco_color_quantization=10,
)
props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
if 'export_vertex_color' in props:
    opciones['export_vertex_color'] = 'ACTIVE'
else:
    opciones['export_colors'] = True
opciones = {k: v for k, v in opciones.items() if k in props}
bpy.ops.export_scene.gltf(**opciones)
info = {
    'regiones': REGIONES[1:], 'triangulos': len(cuerpo.data.polygons),
    'alto': max(v.co.z for v in cuerpo.data.vertices),
    'caras_por_region': {REGIONES[k] or 'ninguna': v for k, v in sorted(recuento.items())},
}
with open(os.path.splitext(os.path.abspath(SALIDA))[0] + '.json', 'w', encoding='utf-8') as f:
    json.dump(info, f, ensure_ascii=False, indent=2)
paso(f'hecho: {SALIDA} ({os.path.getsize(SALIDA) / 1e6:.2f} MB)')

# ── 6. Rig (opcional, FERRO_RIG=ruta.glb): el mismo cuerpo con esqueleto para las animaciones ──
# Con FERRO_PUNTOS=ruta.json guarda también puntos de la superficie (cada PUNTOS_REJILLA m) agrupados
# por el hueso que más los mueve, en coordenadas de three.js: con ellos las animaciones comprueban
# que el cuerpo no atraviesa bancos, cajones ni el suelo.
RIG = os.environ.get('FERRO_RIG')
if RIG:
    paso('rig: articulaciones de los huesos de Z-Anatomy')
    traslado = Vector((-cx, -cy, -minz))

    def vertices_de(nombre):
        o = bpy.data.objects[nombre]
        return [o.matrix_world @ v.co for v in o.data.vertices]

    def media(puntos):
        return sum(puntos, Vector()) / len(puntos)

    def extremo(nombre, eje, lado, margen):
        # Media de los vértices del extremo de un hueso (p. ej. la cabeza del húmero: los de más arriba).
        pts = vertices_de(nombre)
        valores = [getattr(q, eje) for q in pts]
        corte = (max(valores) - margen) if lado == 'max' else (min(valores) + margen)
        return media([q for q in pts if (getattr(q, eje) >= corte if lado == 'max' else getattr(q, eje) <= corte)])

    def centro(nombre):
        return media(vertices_de(nombre))

    fem = vertices_de('Femur.l')
    zf = max(q.z for q in fem); xf = min(q.x for q in fem)
    cabeza_femur = media([q for q in fem if q.z > zf - 0.045 and q.x < xf + 0.06])
    rodilla = (extremo('Femur.l', 'z', 'min', 0.03) + extremo('Tibia.l', 'z', 'max', 0.03)) / 2
    tobillo = centro('Talus.l')
    base_dedos_pie = extremo('Second metatarsal bone.l', 'y', 'min', 0.015)
    punta_pie = centro('Distal phalanx of third finger of foot.l')
    hombro = extremo('Humerus.l', 'z', 'max', 0.05)
    codo = extremo('Humerus.l', 'z', 'min', 0.03)
    muneca = (extremo('Radius.l', 'z', 'min', 0.02) + extremo('Ulna.l', 'z', 'min', 0.02)) / 2
    nudillo = extremo('Third metacarpal bone.l', 'z', 'min', 0.012)
    yema = centro('Distal phalanx of third finger of hand.l')
    clav_esternal = extremo('Clavicle.l', 'x', 'min', 0.02)
    clav_acromial = extremo('Clavicle.l', 'x', 'max', 0.02)
    eje = lambda nombre: Vector((0.0, centro(nombre).y, centro(nombre).z))
    l5, l3, t12, t6, c7, c1 = (eje(n) for n in ('Vertebra L5', 'Vertebra L3', 'Vertebra T12', 'Vertebra T6', 'Vertebra C7', 'Atlas (C1)'))
    coronilla = Vector((0.0, c1.y - 0.01, max(v.co.z for v in cuerpo.data.vertices) - traslado.z))
    pelvis = Vector((0.0, l5.y, (cabeza_femur.z + l5.z) / 2))

    espejo = lambda v: Vector((-v.x, v.y, v.z))
    huesos = [
        ('cadera', pelvis, l3, None), ('lumbar', l3, t12, 'cadera'), ('dorsal', t12, t6, 'lumbar'),
        ('pecho', t6, c7, 'dorsal'), ('cuello', c7, c1, 'pecho'), ('cabeza', c1, coronilla, 'cuello'),
    ]
    for lado, f in (('L', lambda v: v), ('R', espejo)):
        huesos += [
            (f'clavicula.{lado}', f(clav_esternal), f(clav_acromial), 'pecho'),
            (f'brazo.{lado}', f(hombro), f(codo), f'clavicula.{lado}'),
            (f'antebrazo.{lado}', f(codo), f(muneca), f'brazo.{lado}'),
            (f'mano.{lado}', f(muneca), f(nudillo), f'antebrazo.{lado}'),
            (f'dedos.{lado}', f(nudillo), f(yema), f'mano.{lado}'),
            (f'muslo.{lado}', f(cabeza_femur), f(rodilla), 'cadera'),
            (f'pierna.{lado}', f(rodilla), f(tobillo), f'muslo.{lado}'),
            (f'pie.{lado}', f(tobillo), f(base_dedos_pie), f'pierna.{lado}'),
            (f'punta.{lado}', f(base_dedos_pie), f(punta_pie), f'pie.{lado}'),
        ]
    arm = bpy.data.armatures.new('esqueleto')
    esqueleto = bpy.data.objects.new('esqueleto', arm)
    bpy.context.scene.collection.objects.link(esqueleto)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = esqueleto; esqueleto.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for nombre, cabeza, cola, padre in huesos:
        h = arm.edit_bones.new(nombre)
        h.head = cabeza + traslado
        h.tail = cola + traslado
        h.roll = 0.0
        if padre:
            h.parent = arm.edit_bones[padre]
    bpy.ops.object.mode_set(mode='OBJECT')
    articulaciones = {n: [round(c, 4) for c in (cab + traslado)] for n, cab, _, _ in huesos}

    paso('rig: pesos automáticos')
    bpy.ops.object.select_all(action='DESELECT')
    cuerpo.select_set(True); esqueleto.select_set(True); bpy.context.view_layer.objects.active = esqueleto
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    usados = {g.group for v in cuerpo.data.vertices for g in v.groups if g.weight > 0.01}
    sin_pesos = [g.name for g in cuerpo.vertex_groups if g.index not in usados]
    huerfanos = sum(1 for v in cuerpo.data.vertices if not v.groups)
    print(f'  huesos sin pesos: {sin_pesos}; vértices sin hueso: {huerfanos}')

    PUNTOS = os.environ.get('FERRO_PUNTOS')
    if PUNTOS:
        nombre_grupo = {g.index: g.name for g in cuerpo.vertex_groups}
        celdas, puntos = set(), {}
        for v in cuerpo.data.vertices:
            if not v.groups:
                continue
            g = max(v.groups, key=lambda x: x.weight)
            hueso = nombre_grupo[g.group]
            celda = (hueso,) + tuple(math.floor(c / PUNTOS_REJILLA) for c in v.co)
            if celda in celdas:
                continue
            celdas.add(celda)
            puntos.setdefault(hueso, []).extend([round(v.co.x, 3), round(v.co.z, 3), round(-v.co.y, 3)])
        with open(os.path.abspath(PUNTOS), 'w', encoding='utf-8') as f:
            json.dump(puntos, f, separators=(',', ':'))
        print(f'  puntos de la superficie: {sum(len(p) for p in puntos.values()) // 3}')

    paso('rig: exportar')
    bpy.ops.object.select_all(action='DESELECT')
    cuerpo.select_set(True); esqueleto.select_set(True); bpy.context.view_layer.objects.active = esqueleto
    opciones_rig = dict(opciones, filepath=os.path.abspath(RIG), export_skins=True, export_animations=False, export_def_bones=False)
    opciones_rig = {k: v for k, v in opciones_rig.items() if k in props}
    bpy.ops.export_scene.gltf(**opciones_rig)
    with open(os.path.splitext(os.path.abspath(RIG))[0] + '.json', 'w', encoding='utf-8') as f:
        json.dump({'huesos': [h[0] for h in huesos], 'articulaciones': articulaciones}, f, ensure_ascii=False, indent=2)
    paso(f'hecho: {RIG} ({os.path.getsize(RIG) / 1e6:.2f} MB)')

# ── Capturas de control (opcional) ─────────────────────────────────────────────────────────
if CAPTURAS:
    paleta = ['#b3b3b3', '#e6194b', '#f58231', '#ffe119', '#bfef45', '#3cb44b', '#42d4f4', '#4363d8', '#911eb4',
              '#f032e6', '#fabed4', '#469990', '#dcbeff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000',
              '#ffd8b1', '#000075', '#a9a9a9', '#e6beff', '#00a6a6', '#ff6f61']
    def rgb(h):
        return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (1, 3, 5))
    vis = cuerpo.data.color_attributes.new('vista', 'FLOAT_COLOR', 'CORNER')
    for p in cuerpo.data.polygons:
        c = rgb(paleta[region[p.index]])
        for li in p.loop_indices:
            vis.data[li].color = (*c, 1.0)
    with open(f'{CAPTURAS}_leyenda.txt', 'w', encoding='utf-8') as f:
        for i, r in enumerate(REGIONES):
            f.write(f'{paleta[i]} {r or "ninguna"}' + chr(10))
    cuerpo.data.color_attributes.active_color = vis
    vista = bpy.data.scenes.new('vista'); vista.collection.objects.link(cuerpo)
    vista.render.engine = 'BLENDER_WORKBENCH'
    vista.display.shading.light = 'STUDIO'; vista.display.shading.show_cavity = True
    vista.world = bpy.data.worlds.new('w'); vista.world.color = (0.08, 0.08, 0.09)
    vista.display.shading.background_type = 'WORLD'
    vista.view_settings.view_transform = 'Standard'
    vista.render.resolution_x, vista.render.resolution_y = 600, 1000
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); vista.collection.objects.link(cam); vista.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 1.9
    for tipo in ('SINGLE', 'VERTEX'):
        vista.display.shading.color_type = tipo
        vista.display.shading.single_color = (0.72, 0.72, 0.72)
        for nombre, d in (('frente', Vector((0, -1, 0))), ('espalda', Vector((0, 1, 0))), ('perfil', Vector((1, 0, 0)))):
            cam.location = Vector((0, 0, 0.88)) + d * 4
            cam.rotation_euler = (math.pi / 2, 0, math.atan2(d.x, -d.y))
            vista.render.filepath = f'{CAPTURAS}_{"regiones" if tipo == "VERTEX" else "arcilla"}_{nombre}.png'
            bpy.ops.render.render(write_still=True, scene=vista.name)
