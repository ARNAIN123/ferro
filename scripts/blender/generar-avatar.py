# Genera el avatar paramétrico de Ferro (public/modelos/avatar.glb y avatar.json) sobre el cuerpo de
# MakeHuman/MPFB (CC0), con la definición muscular y las regiones del cuerpo de Z-Anatomy.
#
# Uso (Blender 4.5 LTS, sin ventana):
#   blender --background --factory-startup --python scripts/blender/generar-avatar.py -- \
#           <mpfb2>/src/mpfb/data public/modelos [prefijo_capturas]
#
# Fuentes: MPFB2 (https://github.com/makehumancommunity/mpfb2), cuya malla base, deformadores («targets»)
# y esqueleto son CC0; y public/modelos/cuerpo.glb + cuerpo-rig.json (el cuerpo de Z-Anatomy que genera
# generar-cuerpo.py, CC BY-SA 4.0), del que se transfieren las regiones musculares y el relieve.
#
# Pasos:
#   1. Malla base de MakeHuman (solo el cuerpo) y sus deformadores. La forma sale como en MakeHuman:
#      cada combinación sexo × edad × músculo × peso es una «esquina» y entre ellas se interpola.
#   2. Postura anatómica: los brazos y las piernas se llevan, con el esqueleto y los pesos de MakeHuman,
#      a la postura del cuerpo de Z-Anatomy (brazos abajo, palmas al frente). Es la postura de reposo.
#   3. Esqueleto de Ferro (50 huesos: los 24 de las animaciones y, en cada mano, las tres falanges de
#      cada dedo —«dedos», «dedos2» y «dedos3» son las del corazón— y dos del pulgar, para cerrar el
#      puño y agarrar): sus articulaciones son medias de vértices de la malla, así que se recalculan
#      con cualquier forma. Los pesos salen de juntar los de MakeHuman.
#   4. Transferencia: la malla, ajustada hueso a hueso al cuerpo de Z-Anatomy y envuelta sobre él, sirve
#      para hornear en su mapa UV las regiones, la piel sobre los músculos profundos, la oclusión y el
#      relieve muscular (mapa de normales).
#   5. Exporta el GLB (malla con esqueleto y los deformadores como morph targets) y avatar.json (cómo
#      interpolar, cómo se mueven las articulaciones con cada deformador y qué mide cada medida).
import bpy, bmesh, sys, os, json, gzip, math, struct
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
MPFB = ARGS[0]
SALIDA = ARGS[1] if len(ARGS) > 1 else 'public/modelos'
CAPTURAS = ARGS[2] if len(ARGS) > 2 else None
ETAPA = os.environ.get('FERRO_ETAPA', 'todo')


def paso(texto):
    print(f'[avatar] {texto}', flush=True)


# ── 1. Malla base y deformadores ─────────────────────────────────────────────────────────────
# MakeHuman: decímetros, Y arriba, Z al frente. Blender: metros, Z arriba, −Y al frente.
def a_blender(p):
    p = np.asarray(p, dtype=np.float64)
    return np.stack([p[..., 0], -p[..., 2], p[..., 1]], axis=-1) * 0.1


paso('malla base de MakeHuman')
verts, uvs, caras, caras_uv, cubos, caras_ojos = [], [], [], [], {}, []
grupo = None
with open(os.path.join(MPFB, '3dobjs', 'base.obj'), encoding='utf-8') as f:
    for linea in f:
        if linea.startswith('v '):
            verts.append([float(x) for x in linea.split()[1:4]])
        elif linea.startswith('vt '):
            uvs.append([float(x) for x in linea.split()[1:3]])
        elif linea.startswith('g '):
            grupo = linea.split()[1]
        elif linea.startswith('f '):
            partes = [p.split('/') for p in linea.split()[1:]]
            vi = [int(p[0]) - 1 for p in partes]
            if grupo == 'body':
                caras.append(vi)
                caras_uv.append([int(p[1]) - 1 for p in partes])
            elif grupo in ('helper-l-eye', 'helper-r-eye'):
                caras_ojos.append(vi)
            elif grupo and grupo.startswith('joint-'):
                cubos.setdefault(grupo, set()).update(vi)
BASE = a_blender(verts)                      # (19158, 3): cuerpo, ayudas y cubos de articulación
N_TODO = len(BASE)
N = 1 + max(max(c) for c in caras)           # vértices del cuerpo: 0…N−1
UV = np.array(uvs)
cubos = {k: np.array(sorted(v)) for k, v in cubos.items()}
OJOS = np.array(sorted({i for c in caras_ojos for i in c}))   # los ojos son una malla aparte: van con la cabeza
NM = N + len(OJOS)                           # vértices de MakeHuman que usa el avatar: el cuerpo y los ojos
paso(f'  {N} vértices de cuerpo, {len(caras)} caras, {len(cubos)} articulaciones')


def cargar_target(ruta):
    """Deformador de MakeHuman → desplazamientos (N_TODO, 3) en metros y ejes de Blender."""
    d = np.zeros((N_TODO, 3))
    with gzip.open(os.path.join(MPFB, 'targets', ruta + '.target.gz'), 'rt', encoding='utf-8') as f:
        for linea in f:
            p = linea.split()
            if len(p) == 4 and not linea.startswith('#'):
                d[int(p[0])] = [float(p[1]), float(p[2]), float(p[3])]
    return a_blender(d)


SEXOS = ('female', 'male')
EDADES = ('young', 'old')
MUSCULOS_MH = ('minmuscle', 'averagemuscle', 'maxmuscle')
PESOS_MH = ('minweight', 'averageweight', 'maxweight')
RAZAS = ('african', 'asian', 'caucasian')


def esquina(sexo, edad, musculo, peso):
    """Forma de una esquina: su deformador universal más la media de las tres etnias de MakeHuman."""
    d = cargar_target(f'macrodetails/universal-{sexo}-{edad}-{musculo}-{peso}')
    for raza in RAZAS:
        d += cargar_target(f'macrodetails/{raza}-{sexo}-{edad}') / len(RAZAS)
    return d


def tres(x):
    """Pesos (mínimo, medio, máximo) de un valor 0–1, como en MakeHuman."""
    return (max(0.0, 1 - 2 * x), 1 - abs(2 * x - 1), max(0.0, 2 * x - 1))


paso('esquinas (sexo × edad × músculo × peso)')
ESQUINAS = [(s, e, m, p) for s in SEXOS for e in EDADES for m in MUSCULOS_MH for p in PESOS_MH]
D_ESQUINA = {c: esquina(*c) for c in ESQUINAS}
D_ALTURA = {(s, e, h): cargar_target(f'macrodetails/height/{s}-{e}-averagemuscle-averageweight-{h}') for s in SEXOS for e in EDADES for h in ('minheight', 'maxheight')}


def pesos_esquinas(sexo, edad, musculo, peso):
    """Peso de cada esquina para sexo (0 mujer, 1 hombre), edad (0 joven, 1 mayor), músculo y peso (0–1)."""
    r = {}
    for (s, e, m, p) in ESQUINAS:
        ws = sexo if s == 'male' else 1 - sexo
        we = edad if e == 'old' else 1 - edad
        r[(s, e, m, p)] = ws * we * tres(musculo)[MUSCULOS_MH.index(m)] * tres(peso)[PESOS_MH.index(p)]
    return r


def forma(sexo=1.0, edad=0.0, musculo=0.5, peso=0.5, altura=0.5):
    """Desplazamientos (N_TODO, 3) de una forma, interpolando entre esquinas como MakeHuman."""
    d = np.zeros((N_TODO, 3))
    for c, w in pesos_esquinas(sexo, edad, musculo, peso).items():
        if w > 0:
            d += w * D_ESQUINA[c]
    for s in SEXOS:
        for e in EDADES:
            w = (sexo if s == 'male' else 1 - sexo) * (edad if e == 'old' else 1 - edad)
            if altura < 0.5:
                d += w * (1 - 2 * altura) * D_ALTURA[(s, e, 'minheight')]
            elif altura > 0.5:
                d += w * (2 * altura - 1) * D_ALTURA[(s, e, 'maxheight')]
    return d


# ── 2. Esqueleto de Ferro sobre el de MakeHuman ──────────────────────────────────────────────
paso('esqueleto y pesos de MakeHuman')
with open(os.path.join(MPFB, 'rigs', 'standard', 'rig.default.json'), encoding='utf-8') as f:
    RIG_MH = json.load(f)
with open(os.path.join(MPFB, 'rigs', 'standard', 'weights.default.json'), encoding='utf-8') as f:
    PESOS_RIG = json.load(f)['weights']
HUESOS_MH = list(RIG_MH.keys())
W_MH = np.zeros((N, len(HUESOS_MH)))
for j, h in enumerate(HUESOS_MH):
    for i, w in PESOS_RIG.get(h, []):
        if i < N:
            W_MH[i, j] = w
assert (W_MH.sum(axis=1) > 0).all(), 'hay vértices del cuerpo sin pesos'
W_MH /= W_MH.sum(axis=1, keepdims=True)

DESCENDIENTES = {}
for h in HUESOS_MH:
    r = [h]
    cambio = True
    while cambio:  # el orden del JSON no garantiza padres antes que hijos
        cambio = False
        for x in HUESOS_MH:
            if RIG_MH[x].get('parent') in r and x not in r:
                r.append(x); cambio = True
    DESCENDIENTES[h] = r


def centro(v, nombre):
    """Centro de un cubo de articulación de MakeHuman en la malla `v`."""
    return v[cubos[nombre]].mean(axis=0)


def giro_entre(a, b):
    """Matriz 3×3 del giro más corto que lleva la dirección `a` a la `b`."""
    return np.array(Vector(a).rotation_difference(Vector(b)).to_matrix())


def sobre(punto, giro):
    """Matriz 4×4 del giro `giro` (3×3) alrededor de `punto`."""
    m = np.eye(4)
    m[:3, :3] = giro
    m[:3, 3] = punto - giro @ punto
    return m


def aplicar(m, p):
    return m[:3, :3] @ p + m[:3, 3]


# Cada articulación de Ferro es una mezcla de cubos de articulación de MakeHuman (se mueven con la
# malla) y va con un hueso de MakeHuman (el que la arrastra al cambiar de postura).
# Dedos además del corazón (que son «dedos», «dedos2» y «dedos3»), con su número en MakeHuman.
OTROS_DEDOS = (('indice', 2), ('anular', 4), ('menique', 5))
DEDOS = {'dedos', 'dedos2', 'dedos3', 'pulgar', 'pulgar2', *(f'{d}{f}' for d, _ in OTROS_DEDOS for f in (1, 2, 3))}


def _lado(l):
    k = l.lower()
    return {
        f'clavicula.{l}': ([(f'joint-{k}-clavicle', 1.0)], 'spine01'),
        f'brazo.{l}': ([(f'joint-{k}-shoulder', 1.0)], f'shoulder01.{l}'),
        f'antebrazo.{l}': ([(f'joint-{k}-elbow', 1.0)], f'upperarm02.{l}'),
        f'mano.{l}': ([(f'joint-{k}-hand', 1.0)], f'lowerarm02.{l}'),
        f'dedos.{l}': ([(f'joint-{k}-finger-3-1', 1.0)], f'wrist.{l}'),
        # Las falanges de cada dedo (las del corazón son «dedos», «dedos2» y «dedos3») y el pulgar.
        f'dedos2.{l}': ([(f'joint-{k}-finger-3-2', 1.0)], f'wrist.{l}'),
        f'dedos3.{l}': ([(f'joint-{k}-finger-3-3', 1.0)], f'wrist.{l}'),
        f'yema.{l}': ([(f'joint-{k}-finger-3-4', 1.0)], f'wrist.{l}'),
        **{f'{dedo}{f}.{l}': ([(f'joint-{k}-finger-{n}-{f}', 1.0)], f'wrist.{l}') for dedo, n in OTROS_DEDOS for f in (1, 2, 3)},
        **{f'yema_{dedo}.{l}': ([(f'joint-{k}-finger-{n}-4', 1.0)], f'wrist.{l}') for dedo, n in OTROS_DEDOS},
        f'pulgar.{l}': ([(f'joint-{k}-finger-1-2', 1.0)], f'wrist.{l}'),
        f'pulgar2.{l}': ([(f'joint-{k}-finger-1-3', 1.0)], f'wrist.{l}'),
        f'yema_pulgar.{l}': ([(f'joint-{k}-finger-1-4', 1.0)], f'wrist.{l}'),
        f'muslo.{l}': ([(f'joint-{k}-upper-leg', 1.0)], f'pelvis.{l}'),
        f'pierna.{l}': ([(f'joint-{k}-knee', 1.0)], f'upperleg02.{l}'),
        f'pie.{l}': ([(f'joint-{k}-ankle', 1.0)], f'lowerleg02.{l}'),
        f'punta.{l}': ([(f'joint-{k}-toe-2-1', 1.0)], f'foot.{l}'),
        f'uña.{l}': ([(f'joint-{k}-toe-2-4', 1.0)], f'foot.{l}'),
    }


ARTICULACIONES = {
    'cadera': ([('joint-pelvis', 0.33), ('joint-spine-4', 0.67)], 'root'),
    'lumbar': ([('joint-spine-3', 0.61), ('joint-spine-2', 0.39)], 'root'),
    'dorsal': ([('joint-spine-2', 0.65), ('joint-spine-1', 0.35)], 'root'),
    'pecho': ([('joint-spine-1', 0.5), ('joint-neck', 0.5)], 'root'),
    'cuello': ([('joint-neck', 0.6), ('joint-head', 0.4)], 'root'),
    'cabeza': ([('joint-head', 0.8), ('joint-head-2', 0.2)], 'root'),
    'coronilla': ([('joint-head-2', 1.0)], 'root'),
    **_lado('L'), **_lado('R'),
}
_CADENA = (('clavicula', 'pecho'), ('brazo', 'clavicula'), ('antebrazo', 'brazo'), ('mano', 'antebrazo'), ('dedos', 'mano'),
           ('muslo', 'cadera'), ('pierna', 'muslo'), ('pie', 'pierna'), ('punta', 'pie'),
           ('dedos2', 'dedos'), ('dedos3', 'dedos2'), ('pulgar', 'mano'), ('pulgar2', 'pulgar'),
           *((f'{d}{f}', f'{d}{f - 1}' if f > 1 else 'mano') for d, _ in OTROS_DEDOS for f in (1, 2, 3)))
PADRES = {'cadera': None, 'lumbar': 'cadera', 'dorsal': 'lumbar', 'pecho': 'dorsal', 'cuello': 'pecho', 'cabeza': 'cuello',
          **{f'{h}.{l}': (p if p in ('pecho', 'cadera') else f'{p}.{l}') for l in 'LR' for h, p in _CADENA}}
# Dónde acaba cada hueso (para dibujarlo y para medir): la articulación siguiente o un extremo.
COLAS = {'cadera': 'lumbar', 'lumbar': 'dorsal', 'dorsal': 'pecho', 'pecho': 'cuello', 'cuello': 'cabeza', 'cabeza': 'coronilla',
         **{f'{h}.{l}': f'{c}.{l}' for l in 'LR' for h, c in (('clavicula', 'brazo'), ('brazo', 'antebrazo'), ('antebrazo', 'mano'), ('mano', 'dedos'), ('dedos', 'dedos2'),
                                                               ('muslo', 'pierna'), ('pierna', 'pie'), ('pie', 'punta'), ('punta', 'uña'),
                                                               ('dedos2', 'dedos3'), ('dedos3', 'yema'), ('pulgar', 'pulgar2'), ('pulgar2', 'yema_pulgar'),
                                                               *((f'{d}{f}', f'{d}{f + 1}' if f < 3 else f'yema_{d}') for d, _ in OTROS_DEDOS for f in (1, 2, 3)))}}
HUESOS = list(PADRES.keys())
EXTREMOS = [a for a in ARTICULACIONES if a not in PADRES]


def hueso_ferro(h):
    """Hueso de Ferro (de los 50) al que van los pesos de un hueso de MakeHuman."""
    lado = h[-1] if h.endswith(('.L', '.R')) else None
    b = h[:-2] if lado else h
    con = lambda nombre: f'{nombre}.{lado}'
    if b in ('root', 'pelvis', 'spine05'): return 'cadera'
    if b == 'spine04': return 'lumbar'
    if b == 'spine03': return 'dorsal'
    if b in ('spine02', 'spine01', 'breast'): return 'pecho'
    if b.startswith('neck'): return 'cuello'
    if b in ('clavicle', 'shoulder01'): return con('clavicula')
    if b.startswith('upperarm'): return con('brazo')
    if b.startswith('lowerarm'): return con('antebrazo')
    if b == 'wrist' or b.startswith('metacarpal') or b == 'finger1-1': return con('mano')
    if b == 'finger1-2': return con('pulgar')
    if b == 'finger1-3': return con('pulgar2')
    if b.startswith('finger3'): return con({'1': 'dedos', '2': 'dedos2', '3': 'dedos3'}[b[-1]])
    if b.startswith('finger'):
        return con({n: d for d, n in OTROS_DEDOS}[int(b[6])] + b[-1])
    if b.startswith('upperleg'): return con('muslo')
    if b.startswith('lowerleg'): return con('pierna')
    if b == 'foot': return con('pie')
    if b.startswith('toe'): return con('punta')
    return 'cabeza'  # cabeza, mandíbula, ojos y músculos de la cara


W_TODO = np.zeros((N, len(HUESOS)))
for j, h in enumerate(HUESOS_MH):
    W_TODO[:, HUESOS.index(hueso_ferro(h))] += W_MH[:, j]
# Como mucho 4 huesos por vértice (glTF).
W = W_TODO.copy()
np.put_along_axis(W, np.argsort(-W, axis=1)[:, 4:], 0, axis=1)
W /= W.sum(axis=1, keepdims=True)

# Partes del cuerpo (para no confundir el brazo con el costado ni una pierna con la otra).
PARTES = ('tronco', 'brazo.L', 'brazo.R', 'pierna.L', 'pierna.R')


def parte_de(hueso):
    b, _, lado = hueso.partition('.')
    if b in ('brazo', 'antebrazo', 'mano') or b in DEDOS: return f'brazo.{lado}'
    if b in ('muslo', 'pierna', 'pie', 'punta'): return f'pierna.{lado}'
    return 'tronco'


W_PARTE = np.zeros((N, len(PARTES)))
for j, h in enumerate(HUESOS):
    W_PARTE[:, PARTES.index(parte_de(h))] += W_TODO[:, j]
col = lambda nombre: HUESOS.index(nombre)

# ── 3. Postura de reposo ─────────────────────────────────────────────────────────────────────
# MakeHuman modela el cuerpo con los brazos y las piernas abiertos. La postura de reposo de Ferro es
# la anatómica del cuerpo de Z-Anatomy: brazos abajo y palmas al frente.
with open(os.path.join(SALIDA, 'cuerpo-rig.json'), encoding='utf-8') as f:
    ZA = {k: np.array(v) for k, v in json.load(f)['articulaciones'].items()}


def postura(v, abrir_brazos=0.0, abrir_piernas=0.0):
    """
    Matrices 4×4 por hueso de MakeHuman que llevan la malla `v` a la postura de reposo. `abrir_*`
    separa del cuerpo los brazos y las piernas (radianes) respecto a la postura de Z-Anatomy.
    """
    m = {h: np.eye(4) for h in HUESOS_MH}

    def poner(hueso, matriz):
        for h in DESCENDIENTES[hueso]:
            m[h] = matriz @ m[h]

    for lado, s in (('L', 1), ('R', -1)):
        l = lado.lower()
        reflejo = np.array([s, 1, 1])  # el cuerpo de Z-Anatomy es simétrico: se usa su lado izquierdo
        abre = lambda a: np.array(Matrix.Rotation(-s * a, 3, 'Y'))
        d = lambda a, b, abrir=0.0: abre(abrir) @ ((ZA[f'{b}.L'] - ZA[f'{a}.L']) * reflejo)
        hombro, codo, muneca = (centro(v, f'joint-{l}-{x}') for x in ('shoulder', 'elbow', 'hand'))
        nudillo, indice, menique = (centro(v, f'joint-{l}-finger-{x}-1') for x in (3, 2, 5))
        # Brazo: del hombro al codo, como el de Z-Anatomy.
        m1 = sobre(hombro, giro_entre(codo - hombro, d('brazo', 'antebrazo', abrir_brazos)))
        poner(f'upperarm01.{lado}', m1)
        codo1, muneca1 = aplicar(m1, codo), aplicar(m1, muneca)
        # Antebrazo.
        m2 = sobre(codo1, giro_entre(muneca1 - codo1, d('antebrazo', 'mano', abrir_brazos)))
        poner(f'lowerarm01.{lado}', m2)
        acumulada = m2 @ m1
        muneca2 = aplicar(acumulada, muneca)
        eje = (muneca2 - codo1) / np.linalg.norm(muneca2 - codo1)
        # Supinación: la palma mira al frente. Se reparte por el antebrazo (un cuarto en su primera mitad).
        # (índice − muñeca) × (meñique − muñeca) sale del dorso: la palma es el contrario.
        palma = acumulada[:3, :3] @ (np.cross(indice - muneca, menique - muneca) * -s)
        palma -= eje * (palma @ eje)
        frente = np.array([0.0, -1.0, 0.0]) - eje * (np.array([0.0, -1.0, 0.0]) @ eje)
        angulo = math.atan2(np.cross(palma, frente) @ eje, palma @ frente)
        giro = lambda a: np.array(Matrix.Rotation(a, 3, Vector(eje)))
        poner(f'lowerarm01.{lado}', sobre(codo1, giro(angulo * 0.25)))
        poner(f'lowerarm02.{lado}', sobre(codo1, giro(angulo * 0.5)))
        poner(f'wrist.{lado}', sobre(codo1, giro(angulo * 0.25)))
        # Mano: de la muñeca a los nudillos.
        total = m[f'wrist.{lado}']
        muneca3, nudillo3 = aplicar(total, muneca), aplicar(total, nudillo)
        poner(f'wrist.{lado}', sobre(muneca3, giro_entre(nudillo3 - muneca3, d('mano', 'dedos', abrir_brazos))))
        # Pierna.
        cadera, rodilla, tobillo = (centro(v, f'joint-{l}-{x}') for x in ('upper-leg', 'knee', 'ankle'))
        dedo = centro(v, f'joint-{l}-toe-2-1')
        p1 = sobre(cadera, giro_entre(rodilla - cadera, d('muslo', 'pierna', abrir_piernas)))
        poner(f'upperleg01.{lado}', p1)
        rodilla1, tobillo1 = aplicar(p1, rodilla), aplicar(p1, tobillo)
        poner(f'lowerleg01.{lado}', sobre(rodilla1, giro_entre(tobillo1 - rodilla1, d('pierna', 'pie', abrir_piernas))))
        # Pie: sigue plano en el suelo, como en MakeHuman; solo gira sobre la vertical hasta apuntar como
        # el de Z-Anatomy.
        tobillo2 = aplicar(m[f'lowerleg01.{lado}'], tobillo)
        a, b = dedo - tobillo, d('pie', 'punta')
        g = np.array(Matrix.Rotation(math.atan2(b[1], b[0]) - math.atan2(a[1], a[0]), 3, 'Z'))
        pie = np.eye(4)
        pie[:3, :3] = g
        pie[:3, 3] = tobillo2 - g @ tobillo
        for h in DESCENDIENTES[f'foot.{lado}']:
            m[h] = pie
    return m


def posar(v, pose):
    """Vértices del cuerpo de MakeHuman → postura `pose` (mezcla lineal con los pesos de MakeHuman)."""
    M = np.stack([pose[h] for h in HUESOS_MH])
    R = (W_MH @ M[:, :3, :3].reshape(-1, 9)).reshape(-1, 3, 3)
    return np.einsum('vij,vj->vi', R, v[:N]) + W_MH @ M[:, :3, 3]


def articulaciones(v, pose):
    """Articulaciones de Ferro de la malla `v` (con sus cubos), llevadas a la postura `pose`."""
    return {nombre: aplicar(pose[hueso], sum(w * centro(v, cubo) for cubo, w in mezcla)) for nombre, (mezcla, hueso) in ARTICULACIONES.items()}


# Vértices que no deben tocar el resto del cuerpo: el brazo desde algo más abajo de la axila y la
# pierna desde medio muslo (más arriba, el contacto es normal).
_brazo_L = W_PARTE[:, PARTES.index('brazo.L')]
_pierna_L = W_PARTE[:, PARTES.index('pierna.L')]
_h, _c = centro(BASE, 'joint-l-shoulder'), centro(BASE, 'joint-l-elbow')
_t = ((BASE[:N] - _h) @ (_c - _h)) / ((_c - _h) @ (_c - _h))
PRUEBA_BRAZO = np.where((_brazo_L > 0.95) & (_t > 0.55))[0]
_h, _c = centro(BASE, 'joint-l-upper-leg'), centro(BASE, 'joint-l-knee')
_t = ((BASE[:N] - _h) @ (_c - _h)) / ((_c - _h) @ (_c - _h))
PRUEBA_PIERNA = np.where((_pierna_L > 0.95) & (_t > 0.42))[0]
CARAS_SIN_BRAZO_L = [c for c in caras if all(_brazo_L[i] < 0.05 for i in c)]
HOLGURA_BRAZO, HOLGURA_PIERNA = 0.005, 0.004


def brazo_libre(p):
    """¿El brazo izquierdo de la malla posada `p` queda separado del cuerpo?"""
    arbol = BVHTree.FromPolygons([tuple(x) for x in p], CARAS_SIN_BRAZO_L)
    for i in PRUEBA_BRAZO:
        loc, normal, _, dist = arbol.find_nearest(Vector(p[i]), 0.12)
        if loc is not None and (Vector(p[i]) - loc).dot(normal) < HOLGURA_BRAZO:
            return False
    return True


def abrir_libre(v):
    """Lo mínimo que hay que abrir los brazos y las piernas para que no se metan en el cuerpo."""
    def minimo(libre, tope):
        if libre(0.0):
            return 0.0
        a, b = 0.0, tope
        for _ in range(6):
            c = (a + b) / 2
            a, b = (a, c) if libre(c) else (c, b)
        return b
    piernas = minimo(lambda x: posar(v, postura(v, 0.0, x))[PRUEBA_PIERNA, 0].min() >= HOLGURA_PIERNA, 0.35)
    brazos = minimo(lambda x: brazo_libre(posar(v, postura(v, x, piernas))), 0.8)
    return brazos, piernas


def colocar(d):
    """
    Una forma de MakeHuman (desplazamientos `d` sobre la malla base) → vértices (el cuerpo y, detrás,
    los ojos) y articulaciones en la postura de reposo de Ferro, de pie en el suelo (z = 0).
    """
    v = BASE + d
    abrir = abrir_libre(v)
    pose = postura(v, *abrir)
    p = np.concatenate([posar(v, pose), v[OJOS]])  # la cabeza no cambia de postura: los ojos tampoco
    art = articulaciones(v, pose)
    suelo = np.array([0.0, 0.0, p[:, 2].min()])
    return p - suelo, {k: x - suelo for k, x in art.items()}, abrir, suelo[2]


TRIS = np.array([t for c in caras for t in ((c[0], c[1], c[2]), (c[0], c[2], c[3]))])


def volumen(p):
    """Volumen (litros) que encierra la malla."""
    a, b, c = p[TRIS[:, 0]], p[TRIS[:, 1]], p[TRIS[:, 2]]
    return abs(np.einsum('ij,ij->i', a, np.cross(b, c)).sum()) / 6 * 1000


# ── Blender: objetos y capturas ──────────────────────────────────────────────────────────────
def crear_malla(nombre, v, con_uv=True):
    me = bpy.data.meshes.new(nombre)
    me.from_pydata([tuple(p) for p in v[:N]], [], caras)
    me.update()
    if con_uv:
        capa = me.uv_layers.new(name='UVMap')
        k = 0
        for cu in caras_uv:
            for i in cu:
                capa.data[k].uv = UV[i]; k += 1
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(nombre, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def preparar_capturas(ancho, alto, color='OBJECT'):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = color
    sc.display.shading.show_cavity = True
    if sc.world is None:
        sc.world = bpy.data.worlds.new('w')
    sc.world.color = (0.08, 0.08, 0.09)
    sc.display.shading.background_type = 'WORLD'
    sc.view_settings.view_transform = 'Standard'
    sc.render.resolution_x, sc.render.resolution_y = ancho, alto
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = 'ORTHO'
    return sc, cam


def capturar_fila(prefijo, objetos, paso_x=0.8, alto=1.95, color='OBJECT'):
    """Capturas de control: los objetos en fila, de frente, de perfil y de espaldas."""
    n = len(objetos)
    sc, cam = preparar_capturas(int(n * paso_x * 420), int(alto * 420), color)
    for o in sc.objects:
        o.hide_render = o not in objetos and o is not cam
    for i, o in enumerate(objetos):
        o.location.x = (i - (n - 1) / 2) * paso_x
    cam.data.ortho_scale = max(n * paso_x, alto)
    cam.location = (0, -5, alto / 2 - 0.03)
    cam.rotation_euler = (math.pi / 2, 0, 0)
    for nombre, giro in (('frente', 0.0), ('perfil', -math.pi / 2), ('espalda', math.pi)):
        for o in objetos:
            o.rotation_euler.z = giro
        sc.render.filepath = f'{prefijo}_{nombre}.png'
        bpy.ops.render.render(write_still=True)
    for o in objetos:
        o.rotation_euler.z = 0
        o.location.x = 0
    bpy.data.objects.remove(cam)


bpy.ops.wm.read_factory_settings(use_empty=True)
if ETAPA == 'volumenes':
    # Comprobación: volumen y alto de cada esquina (sin posar).
    for c in ESQUINAS:
        v = (BASE + D_ESQUINA[c])[:N]
        paso(f'  {"-".join(c)}: {volumen(v):.1f} L, alto {v[:, 2].max() - v[:, 2].min():.3f} m')
    sys.exit(0)
if ETAPA == 'esquinas':
    # Comprobación: unas cuantas formas en la postura de reposo.
    muestras = [
        ('medio', dict()), ('musculado', dict(musculo=1.0)), ('grueso', dict(peso=1.0)), ('delgado', dict(musculo=0.0, peso=0.0)),
        ('fuerte y grueso', dict(musculo=1.0, peso=1.0)), ('mayor', dict(edad=1.0)), ('mujer', dict(sexo=0.0)), ('mujer gruesa', dict(sexo=0.0, peso=1.0)),
        ('mujer delgada', dict(sexo=0.0, peso=0.0, musculo=0.0)),
    ]
    objetos = []
    for nombre, f in muestras:
        p, art, abrir, _ = colocar(forma(**f))
        paso(f'  {nombre}: alto {p[:, 2].max():.3f} m, {volumen(p):.1f} L, abre brazos {math.degrees(abrir[0]):.1f}° y piernas {math.degrees(abrir[1]):.1f}°; '
             f'cadera {np.round(art["muslo.L"], 3)}, hombro {np.round(art["brazo.L"], 3)}')
        ob = crear_malla(nombre, p, con_uv=False)
        ob.color = (0.72, 0.72, 0.72, 1)
        objetos.append(ob)
    if CAPTURAS:
        capturar_fila(CAPTURAS + '_esquinas', objetos)
    sys.exit(0)


# ── 4. Transferencia desde el cuerpo de Z-Anatomy ────────────────────────────────────────────
# El cuerpo de MakeHuman, con una forma parecida a la del cuerpo de Z-Anatomy, se ajusta sobre él
# (hueso a hueso y después acercando cada vértice a la piel de su misma parte del cuerpo). Con ese
# ajuste, cada punto del mapa UV de MakeHuman tiene su punto en el cuerpo de Z-Anatomy, del que toma
# la región muscular, la marca de músculo profundo y el relieve.
with open(os.path.join(SALIDA, 'cuerpo.json'), encoding='utf-8') as f:
    INFO_ZA = json.load(f)
REGIONES = INFO_ZA['regiones']
PROFUNDOS = INFO_ZA['profundos']
IDS_PROFUNDOS = [REGIONES.index(m) + 1 for m in PROFUNDOS]
FORMA_TRANSFERENCIA = dict(musculo=0.8, peso=0.5)
LADO_IDS, LADO_RELIEVE = 2048, 1024
SUAVIZADO_RELIEVE = int(os.environ.get('FERRO_SUAVIZADO', '90'))  # pasadas: cuanto más, más relieve entra en el mapa
TRIS_UV = np.array([t for c in caras_uv for t in ((c[0], c[1], c[2]), (c[0], c[2], c[3]))])
M_PARTE = np.zeros((len(HUESOS), len(PARTES)))
for j, h in enumerate(HUESOS):
    M_PARTE[j, PARTES.index(parte_de(h))] = 1
CACHE = os.environ.get('FERRO_CACHE_AVATAR')  # carpeta donde guardar los pasos lentos


def en_cache(nombre, calcular):
    """Guarda (o recupera) un paso lento: una carpeta con una matriz por archivo."""
    carpeta = os.path.join(CACHE, nombre) if CACHE else None
    if carpeta and os.path.isdir(carpeta):
        paso(f'  ({nombre}: de la caché)')
        return {a[:-4]: np.load(os.path.join(carpeta, a)) for a in os.listdir(carpeta) if a.endswith('.npy')}
    r = calcular()
    if carpeta:
        os.makedirs(carpeta)
        for k, v in r.items():
            np.save(os.path.join(carpeta, k + '.npy'), v)
    return r


# Vértices de dibujo: un vértice de MakeHuman se repite donde el mapa UV tiene una costura.
_pares, RV = {}, []
TRIS_R = np.empty_like(TRIS)
for i in range(len(TRIS)):
    for k in range(3):
        clave = (int(TRIS[i, k]), int(TRIS_UV[i, k]))
        if clave not in _pares:
            _pares[clave] = len(RV)
            RV.append(clave)
        TRIS_R[i, k] = _pares[clave]
RV_V, RV_T = np.array([v for v, _ in RV]), np.array([t for _, t in RV])
NR = len(RV)
unidad = lambda n: n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


def cargar_za():
    """El cuerpo de Z-Anatomy: vértices, triángulos, región y marca de cada cara y pesos de cada vértice."""
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SALIDA, 'cuerpo-rig.glb'))
    nuevos = [o for o in bpy.data.objects if o not in antes]
    ob = next(o for o in nuevos if o.type == 'MESH' and o.vertex_groups)
    me = ob.data
    assert len(me.loops) == 3 * len(me.polygons)
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    tri = np.empty(len(me.loops), dtype=np.int32)
    me.loops.foreach_get('vertex_index', tri)
    tri = tri.reshape(-1, 3)
    color = np.empty(len(me.loops) * 4)
    me.color_attributes[0].data.foreach_get('color', color)
    color = np.rint(color.reshape(-1, 3, 4)[:, 0, :] * 255).astype(int)
    nombres = [g.name for g in ob.vertex_groups]
    w = np.zeros((len(co), len(HUESOS)))
    for v in me.vertices:
        for g in v.groups:
            w[v.index, HUESOS.index(nombres[g.group])] = g.weight
    w /= np.maximum(w.sum(axis=1, keepdims=True), 1e-9)
    for o in nuevos:
        bpy.data.objects.remove(o)
    return co, tri, color[:, 0], color[:, 2], w


def normales(co, tri):
    """Normales de vértice (ponderadas por área)."""
    n = np.cross(co[tri[:, 1]] - co[tri[:, 0]], co[tri[:, 2]] - co[tri[:, 0]])
    vn = np.zeros_like(co)
    for k in range(3):
        for c in range(3):
            vn[:, c] += np.bincount(tri[:, k], weights=n[:, c], minlength=len(co))
    return unidad(vn)


def vecindad(tri, n):
    a = np.concatenate([tri[:, 0], tri[:, 1], tri[:, 2], tri[:, 1], tri[:, 2], tri[:, 0]])
    b = np.concatenate([tri[:, 1], tri[:, 2], tri[:, 0], tri[:, 0], tri[:, 1], tri[:, 2]])
    return a, b, np.bincount(a, minlength=n).astype(float)


def suavizar(campo, vec, veces, fuerza=0.5):
    """Suaviza un campo por vértice (posiciones o desplazamientos) sobre la malla."""
    a, b, grado = vec
    r = campo.copy()
    con = grado > 0
    for _ in range(veces):
        s = np.stack([np.bincount(a, weights=r[b, c], minlength=len(r)) for c in range(r.shape[1])], axis=1)
        r[con] = r[con] * (1 - fuerza) + fuerza * s[con] / grado[con, None]
    return r


def marco_tangente(p, nv):
    """Tangente, bitangente y normal de cada vértice de dibujo, como `computeTangents` de three.js."""
    pos, uv = p[RV_V], UV[RV_T] * np.array([1.0, -1.0])  # en glTF la v va hacia abajo
    a, b, c = TRIS_R[:, 0], TRIS_R[:, 1], TRIS_R[:, 2]
    vB, vC, uB, uC = pos[b] - pos[a], pos[c] - pos[a], uv[b] - uv[a], uv[c] - uv[a]
    det = uB[:, 0] * uC[:, 1] - uC[:, 0] * uB[:, 1]
    r = np.where(np.abs(det) > 1e-14, 1 / np.where(np.abs(det) > 1e-14, det, 1), 0)[:, None]
    sdir = (vB * uC[:, 1:] - vC * uB[:, 1:]) * r
    tdir = (vC * uB[:, :1] - vB * uC[:, :1]) * r
    tan1, tan2 = np.zeros_like(pos), np.zeros_like(pos)
    for k in (a, b, c):
        for j in range(3):
            tan1[:, j] += np.bincount(k, weights=sdir[:, j], minlength=len(pos))
            tan2[:, j] += np.bincount(k, weights=tdir[:, j], minlength=len(pos))
    n = nv[RV_V]
    t = unidad(tan1 - n * (n * tan1).sum(1, keepdims=True))
    w = np.where((np.cross(n, tan1) * tan2).sum(1) < 0, -1.0, 1.0)
    return t, np.cross(n, t) * w[:, None], n


def ajuste_por_huesos(art, alto_mh, alto_za, radial):
    """Matrices 4×4 (una por hueso de Ferro) que llevan el cuerpo de MakeHuman sobre el de Z-Anatomy."""
    F = {}
    for h in HUESOS:
        cola, a = COLAS[h], art[h]
        if h not in ZA:  # falanges y pulgar (el cuerpo de Z-Anatomy no los tiene): como su padre
            F[h] = F[PADRES[h]].copy()
            continue
        if cola in ZA:
            eje_m, eje_z = art[cola] - a, ZA[cola] - ZA[h]
            u = eje_m / np.linalg.norm(eje_m)
            s, r = np.linalg.norm(eje_z) / np.linalg.norm(eje_m), radial.get(h, 1.0)
            A = giro_entre(eje_m, eje_z) @ (r * np.eye(3) + (s - r) * np.outer(u, u))
        elif h == 'cabeza':
            A = (alto_za - ZA[h][2]) / (alto_mh - a[2]) * np.eye(3)
        else:  # dedos y punta: como la mano y el pie
            A = F[PADRES[h]][:3, :3]
        m = np.eye(4)
        m[:3, :3] = A
        m[:3, 3] = ZA[h] - A @ a
        F[h] = m
    return F


def aplicar_ajuste(p, F):
    M = np.stack([F[h] for h in HUESOS])
    R = (W_TODO @ M[:, :3, :3].reshape(-1, 9)).reshape(-1, 3, 3)
    return np.einsum('vij,vj->vi', R, p) + W_TODO @ M[:, :3, 3]


def radio_medio(p, w, a, b):
    """Distancia media al eje del hueso a→b de los vértices que van sobre todo con ese hueso."""
    u = (b - a) / np.linalg.norm(b - a)
    q = p[w > 0.6] - a
    return np.linalg.norm(q - np.outer(q @ u, u), axis=1).mean()


class Piel:
    """La piel del cuerpo de Z-Anatomy, repartida por partes del cuerpo para buscar el punto más cercano."""

    def __init__(self):
        self.co, self.tri, self.region, self.marca, self.w = cargar_za()
        self.es_piel = ~np.isin(self.region, IDS_PROFUNDOS)
        piel = self.tri[self.es_piel]
        self.normal = normales(self.co, piel)
        self.normal_suave = normales(suavizar(self.co, vecindad(piel, len(self.co)), SUAVIZADO_RELIEVE), piel)
        parte = (self.w @ M_PARTE)[self.tri].mean(axis=1)
        puntos = [tuple(x) for x in self.co]
        self.arboles = []
        for k in range(len(PARTES)):
            idx = np.where(self.es_piel & (parte[:, k] >= 0.2))[0]
            self.arboles.append((BVHTree.FromPolygons(puntos, self.tri[idx].tolist()), idx))

    def cercano(self, p, partes):
        """Punto de la piel más cercano a `p` entre las partes dadas → (punto, cara)."""
        mejor = None
        for k in partes:
            arbol, idx = self.arboles[k]
            loc, _, i, dist = arbol.find_nearest(Vector(p))
            if loc is not None and (mejor is None or dist < mejor[2]):
                mejor = (loc, idx[i], dist)
        return mejor[0], mejor[1]


def partes_de(pw):
    """Partes del cuerpo en las que buscar para unos pesos por parte."""
    r = [k for k in range(len(PARTES)) if pw[k] >= 0.2]
    return r or [int(np.argmax(pw))]


def ajustar_sobre_za(piel, p, art):
    """El cuerpo de MakeHuman `p` (posado), llevado sobre la piel de Z-Anatomy."""
    alto_mh, alto_za = p[:, 2].max(), piel.co[piel.tri[piel.es_piel].ravel(), 2].max()
    q = aplicar_ajuste(p, ajuste_por_huesos(art, alto_mh, alto_za, {}))
    # Grosor: cada miembro se ensancha hasta el radio medio del de Z-Anatomy.
    radial = {}
    for base in ('brazo', 'antebrazo', 'muslo', 'pierna'):
        r = np.mean([radio_medio(piel.co, piel.w[:, col(x)], ZA[x], ZA[COLAS[x]]) / radio_medio(q, W_TODO[:, col(x)], ZA[x], ZA[COLAS[x]]) for x in (f'{base}.L', f'{base}.R')])
        radial[f'{base}.L'] = radial[f'{base}.R'] = float(np.clip(r, 0.75, 1.4))
    paso('  grosor por hueso: ' + ', '.join(f'{h} {r:.2f}' for h, r in radial.items() if h.endswith('.L')))
    q = aplicar_ajuste(p, ajuste_por_huesos(art, alto_mh, alto_za, radial))
    inicial = q.copy()
    vec = vecindad(TRIS, N)
    partes = [partes_de(pw) for pw in W_PARTE]
    for vuelta in range(12):
        destino = np.array([piel.cercano(q[i], partes[i])[0] for i in range(N)])
        q += 0.8 * suavizar(destino - q, vec, 8 if vuelta < 6 else 3 if vuelta < 10 else 1)
    resto = np.linalg.norm(np.array([piel.cercano(q[i], partes[i])[0] for i in range(N)]) - q, axis=1)
    paso(f'  ajuste: distancia a la piel media {resto.mean() * 1000:.1f} mm, máxima {resto.max() * 1000:.1f} mm; movido {np.linalg.norm(q - inicial, axis=1).mean() * 1000:.1f} mm de media')
    return q


def rasterizar(lado):
    """Texels del mapa UV cubiertos por la malla → (columna, fila, triángulo, coordenadas baricéntricas)."""
    uv = UV[TRIS_UV] * lado
    xs, ys, ts, bs = [], [], [], []
    for t in range(len(TRIS)):
        (x0, y0), (x1, y1), (x2, y2) = uv[t]
        den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if abs(den) < 1e-12:
            continue
        ax, bx = max(int(math.floor(min(x0, x1, x2) - 0.5)), 0), min(int(math.ceil(max(x0, x1, x2) - 0.5)), lado - 1)
        ay, by = max(int(math.floor(min(y0, y1, y2) - 0.5)), 0), min(int(math.ceil(max(y0, y1, y2) - 0.5)), lado - 1)
        if bx < ax or by < ay:
            continue
        X, Y = np.meshgrid(np.arange(ax, bx + 1), np.arange(ay, by + 1))
        cx, cy = X + 0.5, Y + 0.5
        l0 = ((y1 - y2) * (cx - x2) + (x2 - x1) * (cy - y2)) / den
        l1 = ((y2 - y0) * (cx - x2) + (x0 - x2) * (cy - y2)) / den
        l2 = 1 - l0 - l1
        m = (l0 >= -1e-4) & (l1 >= -1e-4) & (l2 >= -1e-4)
        if m.any():
            xs.append(X[m]); ys.append(Y[m]); ts.append(np.full(int(m.sum()), t)); bs.append(np.stack([l0[m], l1[m], l2[m]], axis=1))
    x, y, t, b = np.concatenate(xs), np.concatenate(ys), np.concatenate(ts), np.concatenate(bs)
    _, unicos = np.unique(y.astype(np.int64) * lado + x, return_index=True)  # los de un borde, una sola vez
    return x[unicos], y[unicos], t[unicos], b[unicos]


def corresponder(piel, q):
    """Para cada texel del mapa UV de MakeHuman, su punto en la piel de Z-Anatomy."""
    x, y, t, b = rasterizar(LADO_IDS)
    paso(f'  {len(x)} texels ({100 * len(x) / LADO_IDS ** 2:.0f} % del mapa)')
    tri = TRIS[t]
    p = np.einsum('nk,nkj->nj', b, q[tri])
    pw = np.einsum('nk,nkj->nj', b, W_PARTE[tri])
    varias = (pw >= 0.2).sum(axis=1) != 1
    unica = np.argmax(pw, axis=1)
    cara = np.empty(len(x), dtype=np.int64)
    loc = np.empty((len(x), 3))
    for i in range(len(x)):
        loc[i], cara[i] = piel.cercano(p[i], partes_de(pw[i]) if varias[i] else (unica[i],))
    return dict(x=x, y=y, t=t, b=b, cara=cara, loc=loc)


def hornear(piel, q, tx):
    """Regiones, marcas y relieve del cuerpo de Z-Anatomy en el mapa UV de MakeHuman."""
    lado = LADO_IDS
    x, y, t, b, cara, loc = (tx[k] for k in ('x', 'y', 't', 'b', 'cara', 'loc'))
    tri = TRIS[t]
    por_texel = lambda campo: np.einsum('nk,nk->n', b, campo[tri])
    # Región y marca (la cabeza no lleva: la cara de MakeHuman no es la de Z-Anatomy).
    cabeza = por_texel(W_TODO[:, col('cabeza')]) > 0.5
    ids = np.zeros((lado, lado, 2), dtype=np.uint8)
    ids[y, x, 0] = np.where(cabeza, 0, piel.region[cara])
    ids[y, x, 1] = np.where(cabeza, 0, piel.marca[cara])
    # Normal fina y normal suavizada de la piel en ese punto.
    za = piel.tri[cara]
    A, B, C = piel.co[za[:, 0]], piel.co[za[:, 1]], piel.co[za[:, 2]]
    v0, v1, v2 = B - A, C - A, loc - A
    d00, d01, d11 = (v0 * v0).sum(1), (v0 * v1).sum(1), (v1 * v1).sum(1)
    d20, d21 = (v2 * v0).sum(1), (v2 * v1).sum(1)
    den = np.maximum(d00 * d11 - d01 * d01, 1e-20)
    bv = np.clip((d11 * d20 - d01 * d21) / den, 0, 1)
    bw = np.clip((d00 * d21 - d01 * d20) / den, 0, 1)
    bz = np.stack([np.clip(1 - bv - bw, 0, 1), bv, bw], axis=1)
    fina = unidad(np.einsum('nk,nkj->nj', bz, piel.normal[za]))
    suave = unidad(np.einsum('nk,nkj->nj', bz, piel.normal_suave[za]))
    # Relieve: lo que se desvía la normal fina de la suavizada, llevado sobre la normal de la malla
    # ajustada y escrito en su marco tangente (el mismo que three.js calcula con `computeTangents`).
    tv, bt, nv = marco_tangente(q, normales(q, TRIS))
    tr = TRIS_R[t]
    T, Bt, Nf = (unidad(np.einsum('nk,nkj->nj', b, campo[tr])) for campo in (tv, bt, nv))
    eje, coseno = np.cross(suave, Nf), (suave * Nf).sum(1, keepdims=True)
    objetivo = fina + np.cross(eje, fina) + np.cross(eje, np.cross(eje, fina)) / np.maximum(1 + coseno, 0.05)
    M = np.stack([T, Bt, Nf], axis=2)
    bien = np.abs(np.linalg.det(M)) > 1e-3
    tangente = np.tile(np.array([0.0, 0.0, 1.0]), (len(x), 1))
    tangente[bien] = unidad(np.linalg.solve(M[bien], objetivo[bien][:, :, None])[:, :, 0])
    tangente[tangente[:, 2] < 0.3] = (0, 0, 1)
    # Sin relieve donde la correspondencia no es fiable (pliegues) ni en las manos, los pies y la cabeza
    # (ahí manda la forma de MakeHuman).
    fiable = np.clip((coseno[:, 0] - 0.5) / 0.3, 0, 1)
    sin = W_TODO[:, [col(f'{h}.{l}') for h in ('mano', 'punta', *sorted(DEDOS)) for l in 'LR'] + [col('cabeza')]].sum(axis=1) + 0.6 * W_TODO[:, [col('pie.L'), col('pie.R')]].sum(axis=1)
    fuerza = fiable * (1 - np.clip(por_texel(sin), 0, 1))
    relieve = np.zeros((lado, lado, 2))
    relieve[y, x] = np.clip(tangente[:, :2] * fuerza[:, None], -0.7, 0.7)
    lleno = np.zeros((lado, lado), dtype=bool)
    lleno[y, x] = True
    return ids, relieve, lleno


def dilatar(img, lleno, veces):
    """Extiende la imagen más allá de las islas del mapa UV (para que el filtrado no coja el vacío)."""
    lleno = lleno.copy()
    for _ in range(veces):
        nuevo = lleno.copy()
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            m = ~nuevo & np.roll(lleno, (dy, dx), axis=(0, 1))
            img[m] = np.roll(img, (dy, dx), axis=(0, 1))[m]
            nuevo |= m
        lleno = nuevo
    return lleno


def hornear_oclusion(p, lado):
    """Oclusión ambiental del cuerpo en reposo, en su mapa UV (fila 0 = v 0)."""
    ob = crear_malla('oclusion', p)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 64
    if sc.world is None:
        sc.world = bpy.data.worlds.new('w')
    sc.world.light_settings.distance = 0.12
    img = bpy.data.images.new('oclusion', lado, lado, alpha=False)
    mat = bpy.data.materials.new('oclusion')
    mat.use_nodes = True
    nodo = mat.node_tree.nodes.new('ShaderNodeTexImage')
    nodo.image = img
    mat.node_tree.nodes.active = nodo
    ob.data.materials.append(mat)
    for o in sc.objects:
        o.select_set(o is ob)
    bpy.context.view_layer.objects.active = ob
    sc.render.bake.margin = 16
    bpy.ops.object.bake(type='AO')
    r = np.array(img.pixels[:]).reshape(lado, lado, 4)[:, :, 0].copy()
    bpy.data.objects.remove(ob)
    return r


def guardar_imagen(ruta, datos):
    """Guarda una imagen (alto × ancho × 3, de 0 a 1, fila 0 = v 0) en PNG de 8 bits."""
    alto, ancho = datos.shape[:2]
    img = bpy.data.images.new('salida', ancho, alto, alpha=False)
    img.colorspace_settings.name = 'Non-Color'
    px = np.ones((alto, ancho, 4), dtype=np.float32)
    px[:, :, :3] = datos
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = ruta
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


LADO_HUECO = 40


def huecos_libres(lleno, cuantos, margen=28):
    """Cuadrados libres del mapa UV (lejos de las islas): para los ojos y los músculos profundos."""
    cerca = lleno.copy()
    for _ in range(margen):
        cerca = cerca | np.roll(cerca, 1, 0) | np.roll(cerca, -1, 0) | np.roll(cerca, 1, 1) | np.roll(cerca, -1, 1)
    r, lado = [], lleno.shape[0]
    for fila in range(margen, lado - LADO_HUECO - margen, 8):
        for columna in range(margen, lado - LADO_HUECO - margen, 8):
            if not cerca[fila:fila + LADO_HUECO, columna:columna + LADO_HUECO].any():
                r.append((fila, columna))
                cerca[max(0, fila - margen):fila + LADO_HUECO + margen, max(0, columna - margen):columna + LADO_HUECO + margen] = True
                if len(r) == cuantos:
                    return r
    raise SystemExit('No hay sitio libre en el mapa UV')


paso('transferencia: el cuerpo de MakeHuman sobre el de Z-Anatomy')
PIEL = Piel()


def _ajuste():
    p, art, _, _ = colocar(forma(**FORMA_TRANSFERENCIA))
    return dict(q=ajustar_sobre_za(PIEL, p[:N], art), p=p[:N])


_a = en_cache('ajuste', _ajuste)
Q_AJUSTE, P_TR = _a['q'], _a['p']
paso('transferencia: regiones y relieve al mapa UV')
IDS, RELIEVE, LLENO = hornear(PIEL, Q_AJUSTE, en_cache('texels', lambda: corresponder(PIEL, Q_AJUSTE)))
paso('oclusión ambiental')
OCLUSION = en_cache('oclusion', lambda: dict(ao=hornear_oclusion(colocar(forma())[0], LADO_RELIEVE)))['ao']

if ETAPA == 'transferencia':
    # Comprobación: la malla ajustada, las regiones sobre el cuerpo de MakeHuman y los mapas.
    import colorsys
    partes = [partes_de(pw) for pw in W_PARTE]
    region = np.array([PIEL.region[PIEL.cercano(Q_AJUSTE[i], partes[i])[1]] for i in range(N)])
    paleta = [(0.45, 0.45, 0.45)] + [colorsys.hsv_to_rgb((i * 0.618034) % 1, (0.85, 0.55, 0.7)[i % 3], (0.95, 0.75, 0.6)[(i // 3) % 3]) for i in range(1, 60)]
    objetos = []
    for nombre, v in (('ajustada', Q_AJUSTE), ('makehuman', P_TR)):
        ob = crear_malla(nombre, v, con_uv=False)
        capa = ob.data.color_attributes.new('vista', 'FLOAT_COLOR', 'POINT')
        for i in range(N):
            c = paleta[region[i]]
            capa.data[i].color = (c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2, 1.0)
        ob.data.color_attributes.active_color = capa
        objetos.append(ob)
    if CAPTURAS:
        capturar_fila(CAPTURAS + '_transferencia', objetos, paso_x=0.9, color='VERTEX')
        vista = np.array(paleta)[IDS[:, :, 0]]
        vista[~LLENO] = 0
        guardar_imagen(CAPTURAS + '_ids.png', vista[::2, ::2])
        r = np.ones((LADO_IDS, LADO_IDS, 3))
        r[:, :, :2] = RELIEVE * 0.5 + 0.5
        guardar_imagen(CAPTURAS + '_relieve.png', r[::2, ::2])
        guardar_imagen(CAPTURAS + '_oclusion.png', np.repeat(OCLUSION[:, :, None], 3, axis=2))
    sys.exit(0)


# ── 5. Formas: las esquinas de MakeHuman y los deformadores de medidas ───────────────────────
# Cada esquina (sexo × edad × músculo × peso) se coloca en la postura de reposo con su propio
# esqueleto y es un deformador del GLB (lo que se aparta de la esquina de referencia). La app da un
# peso a cada esquina, como MakeHuman, y con los mismos pesos mezcla las articulaciones.
REF = ('male', 'young', 'averagemuscle', 'averageweight')
NOMBRES_ART = list(ARTICULACIONES.keys())
MEDIDAS = {
    'cuello': ['neck/measure-neck-circ'],
    'hombros': ['torso/measure-shoulder-dist'],
    'pecho': ['torso/measure-bust-circ'],
    'cintura': ['torso/measure-waist-circ'],
    'cadera': ['torso/measure-hips-circ'],
    'brazo': ['arms/measure-upperarm-circ'],
    'antebrazo': ['arms/l-lowerarm-muscle', 'arms/r-lowerarm-muscle'],
    'muslo': ['legs/measure-thigh-circ'],
    'gemelo': ['legs/measure-calf-circ'],
    'piernas': ['legs/measure-upperleg-height', 'legs/measure-lowerleg-height'],
    'brazos': ['arms/measure-upperarm-length', 'arms/measure-lowerarm-length'],
}
OBJETIVOS = [f'{m}{s}' for m in MEDIDAS for s in '-+']


def _formas():
    def colocada(d, suelo=None):
        p, art, _, z = colocar(d)
        j = np.array([art[a] for a in NOMBRES_ART])
        if suelo is not None and abs(z - suelo) < 5e-4:
            # El suelo casi no cambia: se deja donde estaba, para que el deformador no mueva todo el cuerpo.
            p[:, 2] += z - suelo
            j[:, 2] += z - suelo
        return p, j, z

    P, J, Z = zip(*(colocada(D_ESQUINA[c]) for c in ESQUINAS))
    OP, OJ = [], []
    for rutas in MEDIDAS.values():
        for sufijo in ('decr', 'incr'):
            p, j, _ = colocada(D_ESQUINA[REF] + sum(cargar_target(f'{r}-{sufijo}') for r in rutas), Z[ESQUINAS.index(REF)])
            OP.append(p); OJ.append(j)
    return dict(P=np.array(P), J=np.array(J), OP=np.array(OP), OJ=np.array(OJ))


paso('formas: las esquinas y las medidas, en la postura de reposo')
_f = en_cache('formas', _formas)
P_ESQ, J_ESQ = _f['P'], _f['J']
I_REF = ESQUINAS.index(REF)
P_REF, J_REF = P_ESQ[I_REF], J_ESQ[I_REF]
X_OBJ, XJ_OBJ = _f['OP'] - P_REF, _f['OJ'] - J_REF
nombre_esquina = lambda c: '-'.join(c)

# Volumen y alto de cada forma (para que la app sepa qué músculo y qué peso de MakeHuman dan el peso real).
REJILLA = 9
TABLA_VOLUMEN, TABLA_ALTO = np.zeros((2, 2, REJILLA, REJILLA)), np.zeros((2, 2, REJILLA, REJILLA))
for s in (0, 1):
    for e in (0, 1):
        for i, m in enumerate(np.linspace(0, 1, REJILLA)):
            for j, w in enumerate(np.linspace(0, 1, REJILLA)):
                pesos = pesos_esquinas(float(s), float(e), float(m), float(w))
                p = np.tensordot(np.array([pesos[c] for c in ESQUINAS]), P_ESQ, axes=1)
                TABLA_VOLUMEN[s, e, i, j], TABLA_ALTO[s, e, i, j] = volumen(p), p[:, 2].max()

# ── 6. Piezas aparte: los ojos y los músculos profundos ──────────────────────────────────────
# Los ojos de MakeHuman son una malla aparte que va con la cabeza. Los músculos profundos son las
# piezas del cuerpo de Z-Anatomy: cada vértice se mueve con la piel que tiene más cerca (la app lo
# calcula al cambiar la forma, así los deformadores solo guardan la piel y los ojos).
from mathutils import kdtree

paso('piezas: ojos y músculos profundos')
_arbol = kdtree.KDTree(N)
for i in range(N):
    _arbol.insert(Vector(Q_AJUSTE[i]), i)
_arbol.balance()
_t = np.array([t for c in caras_ojos for t in ([(c[0], c[1], c[2]), (c[0], c[2], c[3])] if len(c) == 4 else [tuple(c)])])
_w = np.zeros((len(OJOS), len(HUESOS)))
_w[:, col('cabeza')] = 1
PIEZAS = [dict(nombre='ojos', region=0, pos=P_REF[N:], tris=np.searchsorted(OJOS, _t), w=_w)]
VECINOS = 8
for k, region in enumerate(IDS_PROFUNDOS):
    c = PIEL.tri[PIEL.region == region]
    vs = np.unique(c)
    idx, pes = np.empty((len(vs), VECINOS), dtype=int), np.empty((len(vs), VECINOS))
    for i, v in enumerate(vs):
        r = _arbol.find_n(Vector(PIEL.co[v]), VECINOS)
        idx[i], pes[i] = [x[1] for x in r], [1 / (x[2] ** 2 + 1e-4) for x in r]
    # Pesos de un byte que suman 255 (como los guarda el GLB).
    pes = np.floor(pes / pes.sum(axis=1, keepdims=True) * 255 + 0.5).astype(int)
    pes[np.arange(len(vs)), np.argmax(pes, axis=1)] += 255 - pes.sum(axis=1)
    llevar = lambda X, idx=idx, pes=pes: np.einsum('nk,nkj->nj', pes / 255, X[idx])
    PIEZAS.append(dict(nombre=PROFUNDOS[k], region=region, pos=PIEL.co[vs] + llevar(P_REF[:N] - Q_AJUSTE), tris=np.searchsorted(vs, c), w=llevar(W_TODO), idx=idx, pes=pes))

# ── 7. Texturas ──────────────────────────────────────────────────────────────────────────────
paso('texturas')
_ids, _rel, _lleno, _ao = IDS.copy(), RELIEVE.copy(), LLENO.copy(), OCLUSION.copy()
for pieza, (f, c) in zip(PIEZAS, huecos_libres(LLENO, len(PIEZAS))):
    _ids[f:f + LADO_HUECO, c:c + LADO_HUECO] = (pieza['region'], 0)
    _rel[f:f + LADO_HUECO, c:c + LADO_HUECO] = 0
    _lleno[f:f + LADO_HUECO, c:c + LADO_HUECO] = True
    _ao[f // 2:(f + LADO_HUECO) // 2, c // 2:(c + LADO_HUECO) // 2] = 0.6 if pieza['region'] else 1.0  # dentro del cuerpo hay menos luz
    pieza['uv'] = ((c + LADO_HUECO / 2) / LADO_IDS, (f + LADO_HUECO / 2) / LADO_IDS)
TEXELS_POR_REGION = np.bincount(_ids[:, :, 0][_lleno], minlength=len(REGIONES) + 1)
dilatar(_ids, _lleno, 12)
dilatar(_rel, _lleno, 16)
_rel = _rel.reshape(LADO_RELIEVE, 2, LADO_RELIEVE, 2, 2).mean(axis=(1, 3))
guardar_imagen(os.path.join(SALIDA, 'avatar-regiones.png'), np.dstack([_ids[:, :, 0] / 255, _ids[:, :, 1] / 255, np.zeros((LADO_IDS, LADO_IDS))]))
guardar_imagen(os.path.join(SALIDA, 'avatar-relieve.png'), np.dstack([_rel[:, :, 0] * 0.5 + 0.5, _rel[:, :, 1] * 0.5 + 0.5, _ao]))


# ── 8. GLB y avatar.json ─────────────────────────────────────────────────────────────────────
def a_gltf(p):
    """Ejes de Blender (z arriba) → ejes de glTF y three.js (y arriba)."""
    p = np.asarray(p)
    return np.stack([p[..., 0], p[..., 2], -p[..., 1]], axis=-1)


paso('exportación')
N_FORMA = NR + len(OJOS)  # vértices de dibujo que mueven los deformadores: la piel y los ojos
PRIMERO = np.full(N, -1)  # un vértice de dibujo de cada vértice de MakeHuman
PRIMERO[RV_V[::-1]] = np.arange(NR)[::-1]
POS = np.concatenate([P_REF[RV_V]] + [p['pos'] for p in PIEZAS])
UVS = np.concatenate([UV[RV_T]] + [np.tile(p['uv'], (len(p['pos']), 1)) for p in PIEZAS])
PESOS = np.concatenate([W_TODO[RV_V]] + [p['w'] for p in PIEZAS])
INDICES, ORIGEN, _n, _o = [TRIS_R], [RV_V], NR, N
for p in PIEZAS:
    INDICES.append(p['tris'] + _n)
    ORIGEN.append(_o + np.arange(len(p['pos'])))
    _n, _o = _n + len(p['pos']), _o + len(p['pos'])
INDICES, ORIGEN = np.concatenate(INDICES), np.concatenate(ORIGEN)
NV = len(POS)
assert NV < 65536
UNION_IDX = np.concatenate([PRIMERO[p['idx']] for p in PIEZAS[1:]])
UNION_PES = np.concatenate([p['pes'] for p in PIEZAS[1:]])
# Normales: una por vértice de MakeHuman (las costuras del mapa UV no se notan).
_cara = np.cross(POS[INDICES[:, 1]] - POS[INDICES[:, 0]], POS[INDICES[:, 2]] - POS[INDICES[:, 0]])
_nv = np.zeros((_o, 3))
for k in range(3):
    for c in range(3):
        _nv[:, c] += np.bincount(ORIGEN[INDICES[:, k]], weights=_cara[:, c], minlength=_o)
NORMALES = unidad(_nv)[ORIGEN]
# Como mucho cuatro huesos por vértice, con pesos de un byte que suman 255.
_orden = np.argsort(-PESOS, axis=1)[:, :4]
_w4 = np.take_along_axis(PESOS, _orden, axis=1)
PESOS8 = np.floor(_w4 / _w4.sum(axis=1, keepdims=True) * 255 + 0.5).astype(int)
PESOS8[:, 0] += 255 - PESOS8.sum(axis=1)
HUESOS4 = np.where(PESOS8 > 0, _orden, 0)


class Glb:
    def __init__(self):
        self.bin, self.vistas, self.accesores = bytearray(), [], []

    def vista(self, datos, destino=None):
        while len(self.bin) % 4:
            self.bin.append(0)
        v = {'buffer': 0, 'byteOffset': len(self.bin), 'byteLength': len(datos)}
        if destino:
            v['target'] = destino
        self.bin += datos
        self.vistas.append(v)
        return len(self.vistas) - 1

    def accesor(self, datos, tipo, limites=False, normalizado=False, destino=34962):
        datos = np.ascontiguousarray(datos)
        a = {'bufferView': self.vista(datos.tobytes(), destino), 'componentType': {'float32': 5126, 'uint16': 5123, 'uint8': 5121}[str(datos.dtype)], 'count': len(datos), 'type': tipo}
        if normalizado:
            a['normalized'] = True
        if limites:
            a['min'], a['max'] = datos.reshape(len(datos), -1).min(axis=0).tolist(), datos.reshape(len(datos), -1).max(axis=0).tolist()
        self.accesores.append(a)
        return len(self.accesores) - 1

    def deformador(self, d, total, filas=None):
        """
        Desplazamientos (metros) como enteros de 16 bits normalizados, en un accesor disperso: solo se
        guardan las filas que se mueven (o las de la vista de índices `filas`, que comparten varios).
        """
        q = np.clip(np.rint(d * 32767), -32767, 32767).astype(np.int16)
        if filas is None:
            cuales = np.where(np.abs(q).max(axis=1) > 0)[0]
            filas, q = self.vista(cuales.astype(np.uint16).tobytes()), q[cuales]
        self.accesores.append({'componentType': 5122, 'normalized': True, 'count': total, 'type': 'VEC3', 'min': q.min(axis=0).tolist(), 'max': q.max(axis=0).tolist(),
                               'sparse': {'count': len(q), 'indices': {'bufferView': filas, 'componentType': 5123}, 'values': {'bufferView': self.vista(q.tobytes())}}})
        return len(self.accesores) - 1, len(q)

    def guardar(self, ruta, gltf):
        gltf.update(buffers=[{'byteLength': len(self.bin)}], bufferViews=self.vistas, accessors=self.accesores)
        texto = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
        texto += b' ' * (-len(texto) % 4)
        datos = bytes(self.bin) + b'\0' * (-len(self.bin) % 4)
        with open(ruta, 'wb') as f:
            f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(texto) + 8 + len(datos)))
            f.write(struct.pack('<II', len(texto), 0x4E4F534A) + texto)
            f.write(struct.pack('<II', len(datos), 0x004E4942) + datos)


glb = Glb()
atributos = {
    'POSITION': glb.accesor(a_gltf(POS).astype(np.float32), 'VEC3', limites=True),
    'NORMAL': glb.accesor(a_gltf(NORMALES).astype(np.float32), 'VEC3'),
    'TEXCOORD_0': glb.accesor((UVS * np.array([1.0, -1.0]) + np.array([0.0, 1.0])).astype(np.float32), 'VEC2'),
    'JOINTS_0': glb.accesor(HUESOS4.astype(np.uint8), 'VEC4'),
    'WEIGHTS_0': glb.accesor(PESOS8.astype(np.uint8), 'VEC4', normalizado=True),
    '_ORIGEN': glb.accesor(ORIGEN.astype(np.float32), 'SCALAR'),
}
indices = glb.accesor(INDICES.astype(np.uint16).ravel(), 'SCALAR', destino=34963)
de_forma = lambda X: a_gltf(np.concatenate([X[RV_V], X[N:]]))  # un campo por vértice de MakeHuman → piel y ojos de dibujo
filas_forma = glb.vista(np.arange(N_FORMA, dtype=np.uint16).tobytes())
OTRAS = [i for i in range(len(ESQUINAS)) if i != I_REF]
NOMBRES_MORFOS = [nombre_esquina(ESQUINAS[i]) for i in OTRAS] + OBJETIVOS
morfos, movidos = [], []
for i in OTRAS:
    morfos.append({'POSITION': glb.deformador(de_forma(P_ESQ[i] - P_REF), NV, filas_forma)[0]})
for X in X_OBJ:
    acc, n = glb.deformador(de_forma(X), NV)
    morfos.append({'POSITION': acc})
    movidos.append(n)
J_GLTF = a_gltf(J_REF)
nodos = [{'name': 'avatar', 'mesh': 0, 'skin': 0}]
for h in HUESOS:
    padre = PADRES[h]
    nodo = {'name': h, 'translation': (J_GLTF[NOMBRES_ART.index(h)] - (J_GLTF[NOMBRES_ART.index(padre)] if padre else 0)).round(6).tolist()}
    hijos = [1 + HUESOS.index(x) for x in HUESOS if PADRES[x] == h]
    if hijos:
        nodo['children'] = hijos
    nodos.append(nodo)
inversas = np.tile(np.eye(4, dtype=np.float32), (len(HUESOS), 1, 1))
for i, h in enumerate(HUESOS):
    inversas[i, 3, :3] = -J_GLTF[NOMBRES_ART.index(h)]  # por columnas: la traslación va en la última
glb.guardar(os.path.join(SALIDA, 'avatar.glb'), {
    'asset': {'version': '2.0', 'generator': 'Ferro (scripts/blender/generar-avatar.py)', 'copyright': 'MakeHuman/MPFB (CC0) y Z-Anatomy (CC BY-SA 4.0)'},
    'extensionsUsed': ['KHR_mesh_quantization'], 'extensionsRequired': ['KHR_mesh_quantization'],
    'scene': 0, 'scenes': [{'nodes': [0, 1]}], 'nodes': nodos,
    'meshes': [{
        'name': 'avatar', 'primitives': [{'attributes': atributos, 'indices': indices, 'targets': morfos, 'material': 0}], 'weights': [0] * len(morfos),
        'extras': {
            'targetNames': NOMBRES_MORFOS,
            # Unión de los músculos profundos a la piel: para cada vértice (desde `primero`), los vértices
            # de piel con los que se mueve y cuánto pesa cada uno.
            'union': {'primero': N_FORMA, 'vecinos': VECINOS,
                      'indices': glb.accesor(UNION_IDX.astype(np.uint16).ravel(), 'SCALAR', destino=None),
                      'pesos': glb.accesor(UNION_PES.astype(np.uint8).ravel(), 'SCALAR', normalizado=True, destino=None)},
        },
    }],
    'materials': [{'name': 'arcilla', 'pbrMetallicRoughness': {'baseColorFactor': [0.72, 0.7, 0.68, 1], 'metallicFactor': 0, 'roughnessFactor': 0.85}, 'doubleSided': True}],
    'skins': [{'joints': list(range(1, 1 + len(HUESOS))), 'skeleton': 1, 'inverseBindMatrices': glb.accesor(inversas.reshape(-1, 16), 'MAT4', destino=None)}],
})

redondo = lambda a, n=5: np.round(np.asarray(a, dtype=float), n).tolist()
info = {
    'version': 1,
    'fuente': 'Cuerpo paramétrico de MakeHuman/MPFB2 (CC0) con las regiones musculares y el relieve del cuerpo de Z-Anatomy (CC BY-SA 4.0).',
    'ejes': 'y arriba, z hacia delante; metros',
    'vertices': NV, 'vertices_forma': N_FORMA, 'triangulos': len(INDICES), 'triangulos_piel': len(TRIS_R),
    'regiones': REGIONES, 'profundos': PROFUNDOS, 'texels_por_region': TEXELS_POR_REGION.tolist(),
    'piezas': [{'nombre': p['nombre'], 'vertices': len(p['pos']), 'triangulos': len(p['tris'])} for p in PIEZAS],
    'huesos': HUESOS, 'padres': [PADRES[h] for h in HUESOS], 'colas': COLAS,
    'articulaciones': {a: redondo(J_GLTF[i]) for i, a in enumerate(NOMBRES_ART)},
    'macro': {
        # Cada esquina: sexo (0 mujer, 1 hombre), edad (0 joven, 1 mayor), músculo y peso (0 mínimo,
        # 1 medio, 2 máximo), su deformador en el GLB (−1 la de referencia) y lo que mueve cada articulación.
        'edades': [25, 90],
        'esquinas': [{'sexo': SEXOS.index(s), 'edad': EDADES.index(e), 'musculo': MUSCULOS_MH.index(m), 'peso': PESOS_MH.index(p),
                      'morfo': OTRAS.index(i) if i != I_REF else -1, 'articulaciones': redondo(a_gltf(J_ESQ[i] - J_REF))} for i, (s, e, m, p) in enumerate(ESQUINAS)],
        'volumen': redondo(TABLA_VOLUMEN, 2), 'alto': redondo(TABLA_ALTO, 4),
    },
    'objetivos': [{'nombre': nombre, 'morfo': len(OTRAS) + i, 'articulaciones': redondo(a_gltf(XJ_OBJ[i]))} for i, nombre in enumerate(OBJETIVOS)],
    'texturas': {'regiones': {'archivo': 'avatar-regiones.png', 'lado': LADO_IDS}, 'relieve': {'archivo': 'avatar-relieve.png', 'lado': LADO_RELIEVE}},
}
with open(os.path.join(SALIDA, 'avatar.json'), 'w', encoding='utf-8') as f:
    json.dump(info, f, ensure_ascii=False, separators=(',', ':'))
paso(f'  avatar.glb: {NV} vértices ({N_FORMA} de piel y ojos), {len(INDICES)} triángulos, {len(morfos)} deformadores ({len(OTRAS)} esquinas y {len(OBJETIVOS)} de medidas, que mueven {min(movidos)}–{max(movidos)} vértices), {os.path.getsize(os.path.join(SALIDA, "avatar.glb")) / 1e6:.2f} MB')
paso(f'  regiones sin texels: {[REGIONES[i - 1] for i in range(1, len(REGIONES) + 1) if TEXELS_POR_REGION[i] == 0]}')
