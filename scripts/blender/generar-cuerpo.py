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
# El romboides queda bajo el trapecio (con su ventaja es la zona entre las escápulas); los redondos,
# bajo el borde del deltoides posterior y del dorsal; el esplenio, entre el trapecio y el ECM.
VENTAJA_REGION = {'recto_abdominal': 0.012, 'erectores_espinales': 0.025, 'gluteo_mayor': 0.006, 'aductores': 0.003, 'soleo': 0.010,
                  'romboides': 0.030, 'redondo_mayor': 0.025, 'redondo_menor': 0.020, 'esplenio': 0.010}
# Islas de una región con menos caras que esto se quitan (son ruido)… salvo en los músculos pequeños.
ISLA_MINIMA = 120
ISLA_MINIMA_REGION = {'redondo_menor': 20, 'redondo_mayor': 40, 'romboides': 60, 'infraespinoso': 60, 'pectoral_costal': 60}

# Regiones de Ferro (el índice es el id que va en el modelo; 0 = sin músculo de Ferro). Ronda 4: la
# división muscular completa, en el mismo orden que MUSCULOS en src/domain/tipos.ts.
REGIONES = [
    None, 'esternocleidomastoideo', 'esplenio', 'deltoides_anterior', 'deltoides_lateral', 'deltoides_posterior',
    'pectoral_clavicular', 'pectoral_esternal', 'pectoral_costal', 'serrato_anterior', 'trapecio_superior',
    'trapecio_medio', 'trapecio_inferior', 'romboides', 'dorsal_ancho', 'redondo_mayor', 'infraespinoso',
    'redondo_menor', 'supraespinoso', 'subescapular', 'erectores_espinales', 'biceps', 'braquial',
    'braquiorradial', 'triceps_larga', 'triceps_lateral', 'triceps_medial', 'flexores_antebrazo',
    'extensores_antebrazo', 'recto_abdominal', 'oblicuos', 'gluteo_mayor', 'gluteo_medio', 'gluteo_menor',
    'tensor_fascia_lata', 'psoas_iliaco', 'recto_femoral', 'vasto_lateral', 'vasto_medial', 'sartorio',
    'aductores', 'biceps_femoral', 'semitendinoso', 'semimembranoso', 'gemelo_medial', 'gemelo_lateral',
    'soleo', 'tibial_anterior', 'peroneos',
]
# Músculos profundos: no llegan a la piel. Van dentro del cuerpo como piezas propias y la piel que
# tienen encima lleva su marca (índice + 1 en COLOR_0.b) para volverse translúcida al resaltarlos.
PROFUNDOS = ['supraespinoso', 'subescapular', 'gluteo_menor', 'psoas_iliaco']
CARAS_PROFUNDO = 2400       # triángulos de cada músculo profundo (los dos lados)
DISTANCIA_ENCIMA = 0.13     # hasta dónde se busca, hacia dentro, el músculo profundo que hay bajo la piel
# Por qué lado se ve cada uno (componente «hacia atrás» de la normal de la piel, +Y en Blender): el
# psoas-ilíaco, por delante; el subescapular y el supraespinoso, por detrás y por arriba; el glúteo
# menor, por el lado y por detrás.
LADO_PROFUNDO = {'psoas_iliaco': (-1.0, 0.1), 'subescapular': (0.1, 1.0), 'supraespinoso': (-0.2, 1.0), 'gluteo_menor': (-0.35, 1.0)}

# Músculos de Z-Anatomy que dan forma al cuerpo y región de Ferro de cada uno (None: solo forma).
# Las correspondencias siguen las del mapa 2D (src/domain/avatar.ts): el trapecio de Ferro es la
# porción descendente; la espalda media, el trapecio medio e inferior, romboides y manguito posterior.
MUSCULOS = {
    'Clavicular head of pectoralis major muscle': 'pectoral_clavicular',
    'Sternocostal head of pectoralis major muscle': 'pectoral_esternal',
    'Abdominal part of pectoralis major muscle': 'pectoral_costal',
    'Serratus anterior muscle': 'serrato_anterior',
    'Clavicular part of deltoid muscle': 'deltoides_anterior',
    'Acromial part of deltoid muscle': 'deltoides_lateral',
    'Scapular spinal part of deltoid muscle': 'deltoides_posterior',
    'Long head of biceps brachii': 'biceps',
    'Short head of biceps brachii': 'biceps',
    'Brachialis muscle': 'braquial',
    'Coracobrachialis muscle': None,
    'Long head of triceps brachii': 'triceps_larga',
    'Lateral head of triceps brachii': 'triceps_lateral',
    'Medial head of triceps brachii': 'triceps_medial',
    'Anconeus muscle': 'triceps_medial',
    'Brachioradialis muscle': 'braquiorradial',
    'Flexor carpi radialis': 'flexores_antebrazo',
    'Palmaris longus muscle': 'flexores_antebrazo',
    'Humeral head of flexor carpi ulnaris': 'flexores_antebrazo',
    'Ulnar head of flexor carpi ulnaris': 'flexores_antebrazo',
    'Humero-ulnar head of flexor digitorum superficialis': 'flexores_antebrazo',
    'Radial head of flexor digitorum superficialis': 'flexores_antebrazo',
    'Superficial head of pronator teres': 'flexores_antebrazo',
    'Deep head of pronator teres': 'flexores_antebrazo',
    'Flexor digitorum profundus': 'flexores_antebrazo',
    'Flexor pollicis longus': 'flexores_antebrazo',
    'Extensor carpi radialis longus': 'extensores_antebrazo',
    'Extensor carpi radialis brevis': 'extensores_antebrazo',
    'Extensor digitorum': 'extensores_antebrazo',
    'Extensor digiti minimi': 'extensores_antebrazo',
    'Humeral head of extensor carpi ulnaris': 'extensores_antebrazo',
    'Ulnar head of extensor carpi ulnaris': 'extensores_antebrazo',
    'Abductor pollicis longus': 'extensores_antebrazo',
    'Extensor pollicis brevis': 'extensores_antebrazo',
    'Extensor pollicis longus': 'extensores_antebrazo',
    'Supinator': 'extensores_antebrazo',
    # En Z-Anatomy la pieza llamada «Ascending part» es la de arriba (junto al cuello, z ≈ 1,48 m) y la
    # «Descending part» la de abajo (z ≈ 1,31 m): se asignan por su posición real.
    'Ascending part of trapezius muscle': 'trapecio_superior',
    'Transverse part of trapezius muscle': 'trapecio_medio',
    'Descending part of trapezius muscle': 'trapecio_inferior',
    'Rhomboid major muscle': 'romboides',
    'Rhomboid minor muscle': 'romboides',
    'Infraspinatus muscle': 'infraespinoso',
    'Teres minor muscle': 'redondo_menor',
    'Teres major muscle': 'redondo_mayor',
    'Supraspinatus muscle': 'supraespinoso',
    'Subscapularis muscle': 'subescapular',
    'Latissimus dorsi muscle': 'dorsal_ancho',
    'Iliocostalis lumborum muscle': 'erectores_espinales',
    'Iliocostalis thoracis muscle': None,
    'Longissimus thoracis muscle': 'erectores_espinales',
    'Spinalis thoracis muscle': None,
    'Multifidus lumborum muscle': 'erectores_espinales',
    'Rectus abdominis muscle': 'recto_abdominal',
    'Pyramidalis muscle': 'recto_abdominal',
    'External abdominal oblique muscle': 'oblicuos',
    'Gluteus maximus muscle': 'gluteo_mayor',
    'Gluteus medius muscle': 'gluteo_medio',
    'Gluteus minimus muscle': 'gluteo_menor',
    'Tensor fasciae latae': 'tensor_fascia_lata',
    'Psoas major': 'psoas_iliaco',
    'Iliacus muscle': 'psoas_iliaco',
    'Rectus femoris muscle': 'recto_femoral',
    'Vastus lateralis muscle': 'vasto_lateral',
    'Vastus medialis muscle': 'vasto_medial',
    'Vastus intermedius muscle': None,
    'Long head of biceps femoris': 'biceps_femoral',
    'Short head of biceps femoris': 'biceps_femoral',
    'Semitendinosus muscle': 'semitendinoso',
    'Semimembranosus muscle': 'semimembranoso',
    'Adductor longus': 'aductores',
    'Adductor brevis': 'aductores',
    'Adductor magnus': 'aductores',
    'Gracilis muscle': 'aductores',
    'Pectineus muscle': 'aductores',
    'Sartorius muscle': 'sartorio',
    'Medial head of gastrocnemius': 'gemelo_medial',
    'Lateral head of gastrocnemius': 'gemelo_lateral',
    'Soleus muscle': 'soleo',
    'Tibialis anterior muscle': 'tibial_anterior',
    'Extensor digitorum longus': None,
    'Extensor hallucis longus': None,
    'Fibularis longus muscle': 'peroneos',
    'Fibularis brevis muscle': 'peroneos',
    'Iliotibial tract': None,
    'Calcaneal tendon': None,
    'Sternocleidomastoid muscle': 'esternocleidomastoideo',
    'Splenius capitis muscle': 'esplenio',
    'Levator scapulae': None,
    'Scalenus anterior muscle': None,
    'Scalenus medius muscle': None,
    'Scalenus posterior muscle': None,
    'Sternohyoid muscle': None,
    'Omohyoid muscle': None,
}

# Algunas regiones solo existen a cierta altura (m, en el modelo de pie): los erectores suben hasta el
# cuello, pero los «lumbares» de Ferro son la zona baja de la espalda.
ALTURA_REGION = {'erectores_espinales': (0.0, 1.16)}

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


# Piel protegida (no se hunde) que sí lleva región: la espinilla, con el tibial anterior y los peroneos.
CON_REGION = ('Anterior region of leg',)


def sin_region(nombre):
    return any(p in nombre for p in PIEL_PROTEGIDA) and not any(p in nombre for p in CON_REGION)


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
# Un entero por cara: el factor de hundimiento (×100) y, en los millares, si la cara no lleva región.
bm = a_bmesh(piel_objs, 'factor', lambda o: round(100 * factor_hundir(base(o.name))) + (1000 if sin_region(base(o.name)) else 0))
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
bmesh.ops.holes_fill(bm, edges=bm.edges, sides=0)
bm.faces.ensure_lookup_table()
capa_p = bm.faces.layers.int['factor']
factor_de_cara = [(f[capa_p] % 1000) / 100 for f in bm.faces]
sin_region_de_cara = [f[capa_p] >= 1000 for f in bm.faces]
arbol_piel = BVHTree.FromBMesh(bm)
def factor_en(co):
    loc, nor, i, d = arbol_piel.find_nearest(co)
    return factor_de_cara[i] if loc is not None else 1.0
def sin_region_en(co):
    loc, nor, i, d = arbol_piel.find_nearest(co)
    return sin_region_de_cara[i] if loc is not None else False
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

# Triángulos degenerados (agujas de área casi nula que deja la simplificación): se disuelven, porque
# hacen fallar los pesos automáticos del esqueleto («Bone Heat Weighting: failed…»).
bm = bmesh.new(); bm.from_mesh(cuerpo.data)
caras_antes = len(bm.faces)
bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=2e-4)
bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
print(f'  triángulos degenerados disueltos: {caras_antes - len(bm.faces)}')
bm.to_mesh(cuerpo.data); bm.free()

paso('regiones')
bm = bmesh.new(); bm.from_mesh(cuerpo.data)
bm.faces.ensure_lookup_table(); bm.normal_update()
arboles = {}
for rid in sorted(set(region_de_cara)):
    if rid and REGIONES[rid] in PROFUNDOS:
        continue
    sub = bm_m.copy()
    capa_s = sub.faces.layers.int['region']
    bmesh.ops.delete(sub, geom=[f for f in sub.faces if f[capa_s] != rid], context='FACES')
    arboles[rid] = (BVHTree.FromBMesh(sub), VENTAJA_REGION.get(REGIONES[rid], 0.0) if rid else 0.0)
    sub.free()
region = []
for f in bm.faces:
    c = f.calc_center_median()
    # Manos, pies, cabeza, rodillas… no son ningún músculo de Ferro.
    if sin_region_en(c):
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
    if region[f.index] != 0 and len(isla) < ISLA_MINIMA_REGION.get(REGIONES[region[f.index]], ISLA_MINIMA):
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
# FERRO_SIN_AO=1 se la salta (solo para probar deprisa el resto: el modelo queda sin sombreado).
if os.environ.get('FERRO_SIN_AO'):
    for d in ao.data:
        d.color = (1.0, 1.0, 1.0, 1.0)
else:
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

# ── 4b. Músculos profundos ─────────────────────────────────────────────────────────────────
paso('músculos profundos')
id_region = {r: i for i, r in enumerate(REGIONES)}
piezas_profundas = []
for indice, nombre in enumerate(PROFUNDOS):
    objs = [o for o in con_caras('4: Muscular system') if MUSCULOS.get(base(o.name)) == nombre]
    pieza = objeto(a_bmesh(objs), f'profundo_{nombre}')
    aplicar(pieza, 'REMESH', mode='VOXEL', voxel_size=0.004)
    aplicar(pieza, 'LAPLACIANSMOOTH', lambda_factor=1.0, iterations=6, use_volume_preserve=True, use_normalized=True)
    aplicar(pieza, 'DECIMATE', decimate_type='COLLAPSE', ratio=min(1.0, CARAS_PROFUNDO / max(1, 2 * len(pieza.data.polygons))))
    aplicar(pieza, 'TRIANGULATE')
    for pl in pieza.data.polygons:
        pl.use_smooth = True
    col = pieza.data.color_attributes.new('datos', 'FLOAT_COLOR', 'CORNER')
    for pl in pieza.data.polygons:
        for li in pl.loop_indices:
            col.data[li].color = (id_region[nombre] / 255.0, 0.85, 0.0, 1.0)
    piezas_profundas.append(pieza)
    print(f'  {nombre}: {len(objs)} piezas, {len(pieza.data.polygons)} triángulos')

# La piel que tiene encima cada músculo profundo: un rayo hacia dentro desde la piel que da con él
# (por el lado por el que se ve), con dos anillos más de margen.
bm = bmesh.new(); bm.from_mesh(cuerpo.data); bm.verts.ensure_lookup_table(); bm.normal_update()
arboles_profundos = []
for pieza in piezas_profundas:
    bmp = bmesh.new(); bmp.from_mesh(pieza.data)
    arboles_profundos.append(BVHTree.FromBMesh(bmp)); bmp.free()
marca = [0] * len(bm.verts)
for v in bm.verts:
    mejor = None
    for k, arbol in enumerate(arboles_profundos):
        desde, hasta = LADO_PROFUNDO[PROFUNDOS[k]]
        if not (desde <= v.normal.y <= hasta):
            continue
        loc, nor, i, d = arbol.ray_cast(v.co - v.normal * 0.002, -v.normal, DISTANCIA_ENCIMA)
        if loc is not None and (mejor is None or d < mejor[0]):
            mejor = (d, k + 1)
    if mejor:
        marca[v.index] = mejor[1]
for _ in range(2):
    nueva = marca[:]
    for v in bm.verts:
        if not marca[v.index]:
            vecinas = [marca[e.other_vert(v).index] for e in v.link_edges if marca[e.other_vert(v).index]]
            if vecinas:
                nueva[v.index] = vecinas[0]
    marca = nueva
bm.free()
datos = cuerpo.data.color_attributes['datos']
for pl in cuerpo.data.polygons:
    for li, vi in zip(pl.loop_indices, pl.vertices):
        c = datos.data[li].color
        datos.data[li].color = (c[0], c[1], marca[vi] / 255.0, 1.0)
print('  piel encima de cada uno:', {PROFUNDOS[k]: marca.count(k + 1) for k in range(len(PROFUNDOS))})
# Qué regiones tiene encima cada uno (para la ficha del músculo: «debajo de…»).
encima = {n: Counter() for n in PROFUNDOS}
for pl in cuerpo.data.polygons:
    marcas = [marca[vi] for vi in pl.vertices if marca[vi]]
    if marcas and region[pl.index]:
        encima[PROFUNDOS[marcas[0] - 1]][REGIONES[region[pl.index]]] += 1
encima = {n: [r for r, c in cuenta.most_common() if c >= 40] for n, cuenta in encima.items()}
print('  regiones encima:', encima)
triangulos_profundos = {pz.name.replace('profundo_', ''): len(pz.data.polygons) for pz in piezas_profundas}



def unir_profundos(destino, piezas):
    """Une los músculos profundos a `destino` (sus vértices van detrás de los de la piel)."""
    bpy.ops.object.select_all(action='DESELECT')
    for pz in piezas:
        pz.hide_set(False); pz.select_set(True)
    destino.hide_set(False); destino.select_set(True); bpy.context.view_layer.objects.active = destino
    bpy.ops.object.join()
    destino.data.color_attributes.active_color = destino.data.color_attributes['datos']

# El cuerpo, de pie sobre el suelo y centrado.
xs = [v.co for v in cuerpo.data.vertices]
minz = min(v.z for v in xs)
cx = (min(v.x for v in xs) + max(v.x for v in xs)) / 2
cy = (min(v.y for v in xs) + max(v.y for v in xs)) / 2
cuerpo.data.transform(Matrix.Translation((-cx, -cy, -minz)))
for pieza in piezas_profundas:
    pieza.data.transform(Matrix.Translation((-cx, -cy, -minz)))

# ── 5. Exportar ────────────────────────────────────────────────────────────────────────────
paso('exportar')
# Una copia del cuerpo con los músculos profundos dentro (el cuerpo sigue sin ellos para el rig).
estatico = cuerpo.copy(); estatico.data = cuerpo.data.copy(); bpy.context.scene.collection.objects.link(estatico)
copias = []
for pz in piezas_profundas:
    c = pz.copy(); c.data = pz.data.copy(); bpy.context.scene.collection.objects.link(c); copias.append(c)
unir_profundos(estatico, copias)
bpy.ops.object.select_all(action='DESELECT')
estatico.select_set(True); bpy.context.view_layer.objects.active = estatico
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
bpy.data.objects.remove(estatico)
info = {
    'regiones': REGIONES[1:], 'profundos': PROFUNDOS, 'encima': encima, 'triangulos': len(cuerpo.data.polygons) + sum(triangulos_profundos.values()),
    'alto': max(v.co.z for v in cuerpo.data.vertices),
    'caras_por_region': {**{REGIONES[k] or 'ninguna': v for k, v in sorted(recuento.items())}, **triangulos_profundos},
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
    con_hueso = sum(1 for v in cuerpo.data.vertices if v.groups)
    print(f'  pesos automáticos: {con_hueso} de {len(cuerpo.data.vertices)} vértices con hueso')
    if con_hueso < 0.99 * len(cuerpo.data.vertices):
        raise SystemExit('Los pesos automáticos han fallado: el rig no se exporta.')
    # Los músculos profundos (dentro del cuerpo) se unen ahora y toman los pesos del vértice de piel más
    # cercano (los pesos automáticos fallan con piezas dentro de la malla).
    VERTICES_PIEL = len(cuerpo.data.vertices)
    unir_profundos(cuerpo, piezas_profundas)
    print(f'  tras unir los profundos: {sum(1 for v in cuerpo.data.vertices if v.groups)} de {len(cuerpo.data.vertices)} vértices con hueso')
    from mathutils.kdtree import KDTree
    arbol_piel_v = KDTree(VERTICES_PIEL)
    for v in cuerpo.data.vertices[:VERTICES_PIEL]:
        arbol_piel_v.insert(v.co, v.index)
    arbol_piel_v.balance()
    grupos = list(cuerpo.vertex_groups)
    for v in cuerpo.data.vertices[VERTICES_PIEL:]:
        co, j, _ = arbol_piel_v.find(v.co)
        for g in grupos:
            g.remove([v.index])
        for g in cuerpo.data.vertices[j].groups:
            grupos[g.group].add([v.index], g.weight, 'REPLACE')
    usados = {g.group for v in cuerpo.data.vertices for g in v.groups if g.weight > 0.01}
    sin_pesos = [g.name for g in cuerpo.vertex_groups if g.index not in usados]
    huerfanos = sum(1 for v in cuerpo.data.vertices if not v.groups)
    print(f'  huesos sin pesos: {sin_pesos}; vértices sin hueso: {huerfanos}')

    PUNTOS = os.environ.get('FERRO_PUNTOS')
    if PUNTOS:
        nombre_grupo = {g.index: g.name for g in cuerpo.vertex_groups}
        celdas, puntos = set(), {}
        for v in cuerpo.data.vertices[:VERTICES_PIEL]:
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
    import colorsys
    # Un color por región (0 = gris), repartidos por el círculo cromático para distinguir vecinas.
    paleta = ['#b3b3b3'] + ['#%02x%02x%02x' % tuple(round(c * 255) for c in colorsys.hsv_to_rgb((i * 0.618034) % 1, 0.75 if i % 2 else 0.55, 0.95 if i % 3 else 0.75)) for i in range(1, len(REGIONES))]
    def rgb(h):
        return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (1, 3, 5))
    vis = cuerpo.data.color_attributes.new('vista', 'FLOAT_COLOR', 'CORNER')
    datos_c = cuerpo.data.color_attributes['datos']
    for p in cuerpo.data.polygons:
        rid = region[p.index] if p.index < len(region) else round(datos_c.data[p.loop_indices[0]].color[0] * 255)
        c = rgb(paleta[rid])
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
