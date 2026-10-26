"""What Death wears, for BibleGame's figure engine: black hair slicked back,
a black suit (the jacket's skirts below the waist are simulated cloth), a
white shirt and a black tie, polished black shoes, and a black cane with a
silver knob. A man's suit, not a robe: his legs are his own.

Everything is added at run time by patching the engine's dressing (the
`suit` flag in his appearance turns it on); nothing in BibleGame changes.
The jacket's body and sleeves, the shirt, the tie, the trousers and the
shoes are the body's own surface let out and follow it (as the engine's
tunic does); the jacket below the waist hangs from it and swings.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix

import common
import makehuman as mh
import materials as M
import world_cloth as wc
import world_person as wp
from world_cloth import SEG, Garment, _hull2, _radii, angles, bridge, ring_grid, section

F = np.float32
# How far the shoe's sole lies under the foot (death_motion lifts him by it).
SOLE = 0.011


# ── Materials ─────────────────────────────────────────────────────────────
def wool(color, name):
    """Fine black worsted: nearly no colour, a soft sheen that shows its folds
    in a rim of light, a faint twill."""

    def build():
        n = M.Nodes(f"death-wool-{name}")
        rest = n.new("ShaderNodeAttribute", _attribute_name="rest")
        rv = (rest, "Vector")
        blotch = n.noise(12.0, 3.0, 0.5, rv)
        base = n.mix((blotch, "Fac"), M.shade(color, -0.06), M.shade(color, 0.05))
        twill = n.new("ShaderNodeTexWave", Scale=700.0, Distortion=0.6, Detail=1.0, Vector=rv, _bands_direction="DIAGONAL")
        bump = n.bump((twill, "Fac"), strength=0.06, distance=0.001)
        n.bsdf(
            **{
                "Base Color": (base, 2),
                "Roughness": 0.78,
                "Sheen Weight": 0.55,
                "Sheen Roughness": 0.45,
                "Sheen Tint": (0.62, 0.66, 0.74, 1.0),
                "Specular IOR Level": 0.3,
                "Normal": (bump, "Normal"),
            }
        )
        return n.mat

    return M.cached(("death-wool", name, color), build)


def cotton():
    def build():
        n = M.Nodes("death-shirt")
        rest = n.new("ShaderNodeAttribute", _attribute_name="rest")
        weave = n.new("ShaderNodeTexWave", Scale=1400.0, Distortion=1.0, Detail=1.0, Vector=(rest, "Vector"))
        bump = n.bump((weave, "Fac"), strength=0.04, distance=0.001)
        n.bsdf(**{"Base Color": common.hex_rgb("#e4e2dc"), "Roughness": 0.7, "Subsurface Weight": 0.08, "Specular IOR Level": 0.3, "Normal": (bump, "Normal")})
        return n.mat

    return M.cached(("death-shirt",), build)


def satin():
    def build():
        n = M.Nodes("death-tie")
        n.bsdf(**{"Base Color": common.hex_rgb("#0a0a0c"), "Roughness": 0.3, "Specular IOR Level": 0.55, "Anisotropic": 0.6, "Sheen Weight": 0.2})
        return n.mat

    return M.cached(("death-tie",), build)


def polish():
    """Black calf, polished: a hard, narrow highlight."""

    def build():
        n = M.Nodes("death-shoe")
        v = n.noise(60.0, 4.0, 0.6, n.coords())
        bump = n.bump((v, "Fac"), strength=0.04, distance=0.001)
        n.bsdf(**{"Base Color": common.hex_rgb("#08080a"), "Roughness": 0.32, "Coat Weight": 0.8, "Coat Roughness": 0.06, "Specular IOR Level": 0.5, "Normal": (bump, "Normal")})
        return n.mat

    return M.cached(("death-shoe",), build)


def lacquer():
    def build():
        n = M.Nodes("death-cane")
        n.bsdf(**{"Base Color": common.hex_rgb("#060608"), "Roughness": 0.22, "Coat Weight": 1.0, "Coat Roughness": 0.04, "Specular IOR Level": 0.5})
        return n.mat

    return M.cached(("death-cane",), build)


def silver():
    """Old silver: bright, a little worn and tarnished in the hollows."""

    def build():
        n = M.Nodes("death-silver")
        v = n.noise(90.0, 5.0, 0.65, n.coords())
        col = n.mix((v, "Fac"), "#8d9096", "#d4d7dc")
        rough = n.new("ShaderNodeMapRange", Value=(v, "Fac"), **{"From Min": 0.3, "From Max": 0.7, "To Min": 0.32, "To Max": 0.14})
        bump = n.bump((v, "Fac"), strength=0.12, distance=0.0008)
        n.bsdf(**{"Base Color": (col, 2), "Metallic": 1.0, "Roughness": (rough, "Result"), "Normal": (bump, "Normal")})
        return n.mat

    return M.cached(("death-silver",), build)


def slick(color, centre):
    """Hair combed straight back with something in it: black, glossy, in fine
    lines that run from the brow over the crown to the nape (round the
    head's long axis, through `centre`); at the hairline it thins to nothing
    rather than stopping at an edge (the `hw` attribute: how much hair
    grows there)."""

    def build():
        n = M.Nodes(f"death-hair-{color}")
        rest = n.new("ShaderNodeAttribute", _attribute_name="rest")
        hw = n.new("ShaderNodeAttribute", _attribute_name="hw")
        rel = n.new("ShaderNodeVectorMath", _operation="SUBTRACT", Vector=(rest, "Vector"))
        rel.inputs[1].default_value = tuple(float(c) for c in centre)
        sep = n.new("ShaderNodeSeparateXYZ", Vector=(rel, "Vector"))
        phi = n.math("ARCTAN2", (sep, "X"), (sep, "Z"))
        u = n.math("MULTIPLY", (phi, "Value"), 26.0)
        v = n.math("MULTIPLY", (sep, "Y"), 6.0)
        vec = n.new("ShaderNodeCombineXYZ", X=(u, "Value"), Y=(v, "Value"))
        lines = n.new("ShaderNodeTexWave", Scale=1.0, Distortion=2.5, Detail=4.0, **{"Detail Scale": 1.5}, Vector=(vec, "Vector"), _bands_direction="X")
        fine = n.new("ShaderNodeTexWave", Scale=3.1, Distortion=1.2, Detail=2.0, Vector=(vec, "Vector"), _bands_direction="X")
        mixf = n.math("MULTIPLY", (lines, "Fac"), (fine, "Fac"))
        col = n.mix((mixf, "Value"), M.shade(color, -0.45), M.shade(color, 0.45))
        bump = n.bump((mixf, "Value"), strength=0.45, distance=0.0015)
        hair = n.bsdf(
            **{
                "Base Color": (col, 2),
                "Roughness": 0.3,
                "Specular IOR Level": 0.6,
                "Coat Weight": 0.3,
                "Coat Roughness": 0.2,
                "Anisotropic": 0.6,
                "Normal": (bump, "Normal"),
            }
        )
        # Thinning at the hairline, strand by strand.
        speck = n.noise(900.0, 2.0, 0.5, (rest, "Vector"))
        a = n.math("ADD", (hw, "Fac"), (n.math("MULTIPLY", (speck, "Fac"), 0.35), "Value"))
        alpha = n.new("ShaderNodeMapRange", Value=(a, "Value"), **{"From Min": 0.42, "From Max": 0.72, "To Min": 0.0, "To Max": 1.0})
        _alpha(n, hair, (alpha, "Result"))
        return n.mat

    return M.cached(("death-hair", color), build)


def _alpha(n, bsdf, fac):
    """Route a material's BSDF through a mix with transparency: `fac` 1 shows it, 0 not."""
    clear = n.new("ShaderNodeBsdfTransparent")
    mix = n.new("ShaderNodeMixShader")
    n.nt.links.new(fac[0].outputs[fac[1]], mix.inputs[0])
    n.nt.links.new(clear.outputs[0], mix.inputs[1])
    n.nt.links.new(bsdf.outputs[0], mix.inputs[2])
    n.nt.links.new(mix.outputs[0], n.out.inputs["Surface"])


def jacket(color, v_bottom, v_top, y_front, cy, hem):
    """The jacket's wool, open in the lapels' V and cut away below the button
    toward the hem (cut in the shader, from the cloth's rest position: a
    clean line, not the mesh's steps), the lapels rolled back along the V."""

    def build():
        n = M.Nodes(f"death-jacket-{color}")
        rest = n.new("ShaderNodeAttribute", _attribute_name="rest")
        rv = (rest, "Vector")
        sep = n.new("ShaderNodeSeparateXYZ", Vector=rv)
        t = n.new("ShaderNodeMapRange", Value=(sep, "Z"), **{"From Min": v_bottom, "From Max": v_top, "To Min": 0.0, "To Max": 1.0})
        tp = n.math("POWER", (t, "Result"), 0.8)
        opening = n.math("MULTIPLY_ADD", (tp, "Value"), 0.038)
        opening.inputs[2].default_value = 0.008
        diff = n.math("SUBTRACT", (opening, "Value"), (n.math("ABSOLUTE", (sep, "X")), "Value"))
        above = n.math("GREATER_THAN", (sep, "Z"), v_bottom)
        front = n.math("LESS_THAN", (sep, "Y"), y_front)
        where = n.math("MULTIPLY", (above, "Value"), (front, "Value"))
        inside = n.math("MULTIPLY", (n.math("GREATER_THAN", (diff, "Value"), 0.0), "Value"), (where, "Value"))
        # Below the button: the fronts part, the opening widening to the hem.
        back = n.math("SUBTRACT", cy, (sep, "Y"))
        ang = n.math("ABSOLUTE", (n.math("ARCTAN2", (sep, "X"), (back, "Value")), "Value"))
        u = n.new("ShaderNodeMapRange", Value=(sep, "Z"), **{"From Min": v_bottom, "From Max": hem, "To Min": 0.0, "To Max": 1.0})
        cut = n.math("MULTIPLY_ADD", (n.math("POWER", (u, "Result"), 1.5), "Value"), math.radians(34.0))
        cut.inputs[2].default_value = math.radians(4.0)
        below = n.math("LESS_THAN", (sep, "Z"), v_bottom)
        away = n.math("MULTIPLY", (n.math("LESS_THAN", (ang, "Value"), (cut, "Value")), "Value"), (below, "Value"))
        inside = n.math("MAXIMUM", (inside, "Value"), (away, "Value"))
        roll = n.new("ShaderNodeMapRange", _interpolation_type="SMOOTHSTEP", Value=(diff, "Value"), **{"From Min": -0.03, "From Max": 0.0, "To Min": 0.0, "To Max": 1.0})
        lapel = n.math("MULTIPLY", (roll, "Result"), (where, "Value"))
        blotch = n.noise(12.0, 3.0, 0.5, rv)
        base = n.mix((blotch, "Fac"), M.shade(color, -0.06), M.shade(color, 0.05))
        twill = n.new("ShaderNodeTexWave", Scale=700.0, Distortion=0.6, Detail=1.0, Vector=rv, _bands_direction="DIAGONAL")
        b1 = n.bump((twill, "Fac"), strength=0.06, distance=0.001)
        b2 = n.bump((lapel, "Value"), strength=0.7, distance=0.004, normal=(b1, "Normal"))
        cloth = n.bsdf(
            **{
                "Base Color": (base, 2),
                "Roughness": 0.8,
                "Sheen Weight": 0.4,
                "Sheen Roughness": 0.45,
                "Sheen Tint": (0.62, 0.66, 0.74, 1.0),
                "Specular IOR Level": 0.3,
                "Normal": (b2, "Normal"),
            }
        )
        show = n.math("SUBTRACT", 1.0, (inside, "Value"))
        _alpha(n, cloth, (show, "Value"))
        return n.mat

    return M.cached(("death-jacket", color, round(v_bottom, 4)), build)


# ── Hair: a thin shell lying flat on the skull, fuller at the back ────────
_hair = wp.Person._hair


def _slick_hair(self):
    if not self.a.get("suit"):
        return _hair(self)
    base = mh.Base.get()
    body = self.bodyd
    co = body.co
    N = self.look.normals
    bq = base.quads[base.faces_of("body")]
    self.shells = {}
    m = self.look.scalp
    keep = (m[bq].max(1) > 0.04) & (m[bq].mean(1) > 0.02)
    Q = bq[keep]
    used = np.unique(Q)
    remap = -np.ones(len(co), np.int64)
    remap[used] = np.arange(len(used))
    w = wp._smooth(m[used], 0.05, 0.55)
    head = np.asarray(body.J["head"], float)
    rel = co[used] - head
    # Flat on top and pressed close at the temples; at the back of the crown
    # the combed hair gathers a little before the nape.
    back = np.clip((rel[:, 1] - 0.02) / 0.07, 0, 1) * np.clip((rel[:, 2] - 0.02) / 0.08, 0, 1)
    side = np.clip((np.abs(rel[:, 0]) - 0.05) / 0.03, 0, 1) * np.clip((0.14 - rel[:, 2]) / 0.06, 0, 1)
    t = 0.0042 + 0.0045 * back - 0.0015 * side
    V = co[used] + N[used] * (0.0008 + t * w)[:, None]
    self.shells["hair"] = (used, V)
    centre = head + np.array([0.0, 0.01, 0.075])
    obj = wp._mesh(f"{self.name}-hair", V, remap[Q], self.col, slick(self.a["hair"], centre))
    wp.set_attr(obj, "rest", V)
    wp.set_attr(obj, "hw", wp._smooth(m[used], 0.02, 0.5))
    self.rig.bind(obj, body.sk.W[used])
    self.parts.append(wp.Piece(obj))


wp.Person._hair = _slick_hair


# ── The clothes ───────────────────────────────────────────────────────────
_make = wc.Wardrobe._make


def _dress(self):
    if not self.a.get("suit"):
        return _make(self)
    J = self.body.J
    H = self.body.height
    self.covered = []
    self.belt_z = float(J["waist"][2] + (J["pelvis"][2] - J["waist"][2]) * 0.15)
    # A suit jacket's hem: just below the seat.
    self.hem_z = float(J["hip_L"][2]) - 0.11 * H / 1.75
    # The V of the lapels, from the collar to the waist button.
    self.nz = float(J["neck"][2])
    self.v_bottom = float(J["waist"][2]) + 0.03
    self.v_open = lambda z: 0.008 + 0.038 * np.clip((z - self.v_bottom) / (self.nz - self.v_bottom), 0, 1) ** 0.8
    _trousers(self, wool("#0e0f12", "trousers"))
    _shoes(self)
    _jacket(self, "#121317")
    _shirt(self)
    _skirts(self, self.jacket_mat)


wc.Wardrobe._make = _dress

def _subset(self, keep):
    base = mh.Base.get()
    Q = base.quads[base.faces_of("body")]
    Q = Q[keep[Q].all(1)]
    used = np.unique(Q)
    remap = -np.ones(len(self.co), np.int64)
    remap[used] = np.arange(len(used))
    self.covered.append((used, remap[Q]))
    return used, remap[Q]


def hide_covered(person):
    """Take the skin out from under his clothes (a mask on the body, after
    the rig): where a sleeve or a trouser leg lies close, a joint bending
    would push the skin through it. Each garment's edge keeps the skin
    under it, so nothing opens up."""
    hidden = set()
    for used, Q in person.cloth.covered:
        e = np.sort(np.concatenate([Q[:, [0, 1]], Q[:, [1, 2]], Q[:, [2, 3]], Q[:, [3, 0]]]), 1)
        uniq, count = np.unique(e, axis=0, return_counts=True)
        rim = np.unique(uniq[count == 1])
        hidden.update(used[np.setdiff1d(np.arange(len(used)), rim)].tolist())
    keep = ~np.isin(person.body_used, np.fromiter(hidden, np.int64))
    obj = person.body_obj
    g = obj.vertex_groups.new(name="skin")
    g.add(np.nonzero(keep)[0].tolist(), 1.0, "REPLACE")
    m = obj.modifiers.new("covered", "MASK")
    m.vertex_group = "skin"


def _names(self, *prefixes):
    return [n for n in self.names if n.startswith(prefixes)]


def _trousers(self, mat):
    """Trousers, easy over the hips, the legs falling straight from the knee
    to break over the shoe."""
    J = self.body.J
    co = self.co
    b = self.body_idx
    arms = self.bone_weight(*_names(self, "upperarm", "lowerarm", "wrist", "finger", "metacarpal", "shoulder", "clavicle"))
    feet = self.bone_weight(*_names(self, "foot", "toe"))
    keep = np.zeros(len(co), bool)
    keep[b] = (co[b, 2] < self.belt_z + 0.03) & (arms[b] < 0.2) & (feet[b] < 0.4) & (co[b, 2] > 0.045)
    used, Q = _subset(self, keep)
    N = self.p.look.normals[used]
    V = co[used] + N * 0.009
    V = bridge(V, Q, N, iterations=50, soften=12).astype(np.float64)
    knee = float(J["knee_L"][2])
    th = angles(48)
    for s, sgn in (("L", 1.0), ("R", -1.0)):
        leg = self.pts(f"upperleg02.{s}", f"lowerleg01.{s}", f"lowerleg02.{s}", min_w=0.3)

        def centre(z):
            sl = leg[np.abs(leg[:, 2] - z) < 0.015]
            return sl[:, :2].mean(0)

        ck = centre(knee + 0.02)
        rk = _radii(_hull2(leg[np.abs(leg[:, 2] - (knee + 0.02)) < 0.015][:, :2]), ck, th) + 0.02
        ca = centre(0.12)
        sel = (np.sign(V[:, 0]) == sgn) & (V[:, 2] < knee + 0.06)
        z = V[sel, 2]
        f = np.clip((z - 0.12) / (knee + 0.02 - 0.12), 0, 1)[:, None]
        c = ca * (1 - f) + ck * f
        d = V[sel, :2] - c
        r = np.hypot(d[:, 0], d[:, 1])
        a = np.arctan2(d[:, 0], -d[:, 1]) % (2 * math.pi)
        want = np.interp(a, np.append(th, 2 * math.pi), np.append(rk, rk[0])) * (0.9 + 0.1 * f[:, 0])
        # Over the knee the leg narrows into the straight fall (no step at the knee).
        blend = np.clip((knee + 0.06 - z) / 0.08, 0, 1)
        k = np.maximum(1.0, 1.0 + blend * (want / np.maximum(r, 1e-6) - 1.0))
        V[sel, :2] = c + d * k[:, None]
    self.garments.append(Garment("trousers", V.astype(F), Q, mat, weights=self.W[used], thickness=0.002, subsurf=1))


def _shoes(self):
    """Black shoes, lasted: at each height the outline of the foot (the toes
    one rounded toe box), let out for the leather, a little past the toes at
    the front, on a sole; open at the ankle under the trouser hem."""
    co = self.co
    mat = polish()
    th = angles(40)
    for s in "LR":
        foot = self.pts(f"foot.{s}", *[n for n in self.names if n.startswith("toe") and n.endswith("." + s)], min_w=0.3)
        foot = foot[foot[:, 2] < 0.1]
        c = foot[:, :2].mean(0)
        front = float(foot[:, 1].min())
        rings = []
        prev = None
        for z, out in ((-SOLE, 0.007), (-0.002, 0.008), (0.012, 0.007), (0.026, 0.0065), (0.04, 0.006), (0.055, 0.0055), (0.07, 0.005), (0.088, 0.004)):
            band = foot[np.abs(foot[:, 2] - max(z, 0.004)) < 0.009]
            if len(band) < 3:
                band = foot[foot[:, 2] < max(z, 0.004) + 0.012]
            hull = _hull2(band[:, :2])
            r = _radii(hull, c, th)
            k = np.array([1.0, 2.0, 3.0, 2.0, 1.0]) / 9.0
            r = sum(np.roll(r, i) * w for i, w in zip(range(-2, 3), k)) + out
            ring = np.stack([c[0] + np.sin(th) * r, c[1] - np.cos(th) * r, np.full(len(th), z)], 1)
            # A little past the toes, the toe flat on top.
            toe = np.clip((front + 0.07 - ring[:, 1]) / 0.07, 0, 1)
            ring[:, 1] -= 0.014 * toe * (1.0 if z < 0.03 else 0.6)
            rings.append(ring)
            prev = r
        V, Q = ring_grid(rings)
        n = len(th)
        V = np.concatenate([V, [[c[0], c[1] - 0.01, -SOLE]]])
        Q = np.concatenate([Q, np.array([(len(V) - 1, (j + 1) % n, j, j) for j in range(n)])])
        self.garments.append(Garment(f"shoe-{s}", V, Q, mat, weights=self.nearest_weights(V), thickness=0.0, subsurf=1))
        # (The foot under it hidden: the body's own foot, below the trousers.)
        keep = np.zeros(len(co), bool)
        b = self.body_idx
        fw = self.bone_weight(f"foot.{s}", *[n for n in self.names if n.startswith("toe") and n.endswith("." + s)])
        keep[b] = (fw[b] > 0.2) & (co[b, 2] < 0.08)
        _subset(self, keep)


def _jacket(self, color):
    """The suit jacket above the waist and its sleeves (to the wrist), cut
    with square shoulders, close to him; open in a long V to the waist button
    for the shirt and tie (the V is cut in its material: `jacket`)."""
    J = self.body.J
    co = self.co
    b = self.body_idx
    neck = self.bone_weight("neck01", "neck02", "neck03", "head")
    legs = self.bone_weight("upperleg01.L", "upperleg01.R", "upperleg02.L", "upperleg02.R", "pelvis.L", "pelvis.R")
    hand = self.bone_weight(*_names(self, "wrist", "finger", "metacarpal"))
    keep = np.zeros(len(co), bool)
    nz = self.nz
    sleeve = self.bone_weight(*_names(self, "upperarm", "lowerarm"))
    # (The hem cuts the body, not the sleeves: his arms hang below it.)
    keep[b] = ((co[b, 2] > self.belt_z - 0.05) | (sleeve[b] > 0.5)) & (co[b, 2] < nz + 0.005) & (neck[b] < 0.35) & (legs[b] < 0.5) & (hand[b] < 0.45)
    used, Q = _subset(self, keep)
    V = co[used].astype(np.float64)
    N = self.p.look.normals[used]
    arm = self.bone_weight(*_names(self, "upperarm", "shoulder"))[used]
    fore = self.bone_weight(*_names(self, "lowerarm"))[used]
    pad = self.bone_weight("shoulder01.L", "shoulder01.R", "clavicle.L", "clavicle.R")[used] * np.clip(N[:, 2] * 2.0, 0, 1)
    d = 0.011 + 0.003 * pad + 0.001 * arm + 0.005 * fore
    V = V + N * d[:, None]
    # Below the chest the jacket falls straight to the waist (as the engine's tunic does).
    limbs = self.bone_weight(*_names(self, "upperarm", "lowerarm", "wrist", "finger", "metacarpal", "shoulder"))
    torso_pts = co[b][(limbs[b] < 0.2) & (neck[b] < 0.4) & (legs[b] < 0.3)]
    cyw = float(J["chest"][1])
    thb = angles(64)
    zb = np.arange(nz, self.belt_z - 0.07, -0.01)
    table, acc = [], None
    for zz in zb:
        h = section(torso_pts, zz, band=0.008)
        if h is not None:
            r = _radii(h, (0.0, cyw), thb)
            acc = r if acc is None else np.maximum(acc, r)
        table.append(None if acc is None else acc.copy())
    if acc is not None:
        tab = np.array([t if t is not None else acc for t in table])
        lim = limbs[used]
        hang = np.clip((float(J["chest"][2]) + 0.02 - V[:, 2]) / 0.08, 0, 1) * np.clip(1 - lim / 0.2, 0, 1)
        av = np.arctan2(V[:, 0], -(V[:, 1] - cyw)) % (2 * math.pi)
        ai = np.round(av / (2 * math.pi) * 64).astype(int) % 64
        zi = np.clip(np.round((nz - V[:, 2]) / 0.01).astype(int), 0, len(tab) - 1)
        target = tab[zi, ai] + 0.014
        rv = np.hypot(V[:, 0], V[:, 1] - cyw)
        grow = np.maximum(0.0, target - rv) * hang
        dirs = np.stack([V[:, 0], V[:, 1] - cyw], 1) / np.maximum(rv, 1e-6)[:, None]
        V[:, :2] += dirs * grow[:, None]
    # A man's jacket hangs flat across the chest: it does not follow the
    # muscles into two mounds with a hollow between them. At each height its
    # front is a shallow curve through the most forward point of the chest,
    # and the cloth is let out to it (never drawn in).
    lim_u = limbs[used]
    chest_zone = (V[:, 1] < cyw) & (V[:, 2] > self.belt_z - 0.02) & (V[:, 2] < nz - 0.015) & (lim_u < 0.25)
    for zz in np.arange(self.belt_z - 0.02, nz - 0.015, 0.01):
        band = chest_zone & (np.abs(V[:, 2] - zz) < 0.006)
        core = band & (np.abs(V[:, 0]) < 0.11)
        if core.sum() < 3:
            continue
        y_peak = float(V[core, 1].min())
        target = y_peak + 1.1 * V[band, 0] ** 2
        V[band, 1] = np.minimum(V[band, 1], target)
    V = bridge(V, Q, N, iterations=60, soften=14)
    y_front =float(J["chest"][1]) - 0.03
    self.skirt_cy = float(J["pelvis"][1]) + 0.005
    mat = jacket(color, self.v_bottom, nz, y_front, self.skirt_cy, self.hem_z)
    self.jacket_mat = mat
    self.garments.append(Garment("jacket", V, Q, mat, weights=self.W[used], thickness=0.004, subsurf=1))
    # (Not the engine's `bodice_V`: the skirts below hang from the jacket's
    # waist and must not start inside a collider made of it.) Its body
    # without the sleeves, for the skirts to meet.
    self.coat_V = V[limbs[used] < 0.15]
    # The collar: a band standing round the back and sides of the neck,
    # rolled a little outward, open at the front where the lapels begin.
    # (From a little below the neckline, lying out over it, so the jacket's
    # edge round the neck is under it.)
    Vc, Qc = _neck_band(self, nz - 0.034, ((0.0, 0.034), (0.012, 0.026), (0.026, 0.019), (0.04, 0.018), (0.052, 0.021)), 0.7)
    self.garments.append(Garment("collar", Vc, Qc, wool(color, "collar"), weights=self.nearest_weights(Vc), thickness=0.004, subsurf=1))


def _neck_band(self, z0, rows, open_cos):
    """Rings round the neck at z0 + dz, `out` off it: [(dz, out)]; open at the
    front where cos(angle) > open_cos."""
    J = self.body.J
    b = self.body_idx
    neck = self.bone_weight("neck01", "neck02", "neck03", "head")
    npts = self.co[b][neck[b] > 0.5]
    cy = float(J["neck"][1])
    th = angles()
    rings = []
    for dz, out in rows:
        h = section(npts, z0 + dz, band=0.012)
        if h is None:
            h = section(npts, z0 + 0.02, band=0.03)
        r = _radii(h, (0.0, cy), th)
        k = np.array([1.0, 2.0, 3.0, 2.0, 1.0]) / 9.0
        r = sum(np.roll(r, i) * w for i, w in zip(range(-2, 3), k)) + out
        rings.append(np.stack([np.sin(th) * r, cy - np.cos(th) * r, np.full(SEG, z0 + dz)], 1))
    V, Q = ring_grid(rings)
    a = (Q[:, 0] % SEG + 0.5) / SEG * 2 * math.pi
    Q = Q[np.cos(a) < open_cos]
    used = np.unique(Q)
    rm = -np.ones(len(V), np.int64)
    rm[used] = np.arange(len(used))
    return V[used], rm[Q]


def _shirt(self):
    """The shirt and tie under the jacket (seen in its V), and the shirt's
    collar round the neck."""
    J = self.body.J
    co = self.co
    b = self.body_idx
    neck = self.bone_weight("neck01", "neck02", "neck03", "head")
    arms = self.bone_weight(*_names(self, "upperarm", "lowerarm", "wrist", "finger", "metacarpal", "shoulder"))
    nz = self.nz
    front = co[:, 1] < float(J["chest"][1]) - 0.0
    keep = np.zeros(len(co), bool)
    zc = co[b, 2]
    keep[b] = front[b] & (zc > self.v_bottom - 0.05) & (zc < nz + 0.012) & (neck[b] < 0.6) & (arms[b] < 0.3) & (np.abs(co[b, 0]) < self.v_open(zc) + 0.03)
    used, Q = _subset(self, keep)
    N = self.p.look.normals[used]
    V = bridge(co[used] + N * 0.006, Q, N, iterations=30, soften=6)
    self.garments.append(Garment("shirt", V, Q, cotton(), weights=self.W[used], thickness=0.0, subsurf=1))
    # The collar: a band round the neck, its points meeting under the knot.
    Vc, Qc = _neck_band(self, nz - 0.026, ((0.0, 0.012), (0.016, 0.008), (0.036, 0.006), (0.056, 0.005)), 0.985)
    self.garments.append(Garment("shirt-collar", Vc, Qc, cotton(), weights=self.nearest_weights(Vc), thickness=0.002, subsurf=1))
    # The tie: a strip down the middle, its knot at the collar.
    keep = np.zeros(len(co), bool)
    w = 0.012 + 0.014 * np.clip((nz - zc) / 0.22, 0, 1)
    keep[b] = front[b] & (zc > self.v_bottom - 0.06) & (zc < nz + 0.0) & (np.abs(co[b, 0]) < w)
    base = mh.Base.get()
    Qt = base.quads[base.faces_of("body")]
    Qt = Qt[keep[Qt].all(1)]
    ut = np.unique(Qt)
    rm = -np.ones(len(co), np.int64)
    rm[ut] = np.arange(len(ut))
    N = self.p.look.normals[ut]
    V = bridge(co[ut] + N * 0.0095, rm[Qt], N, iterations=20, soften=8)
    self.garments.append(Garment("tie", V, rm[Qt], satin(), weights=self.W[ut], thickness=0.002, subsurf=1))
    # The knot at the front of the collar (the front of the neck there, not
    # the chin above it).
    knot_z = nz + 0.004
    near = co[b][(np.abs(co[b, 2] - knot_z) < 0.012) & (np.abs(co[b, 0]) < 0.02) & (neck[b] > 0.5)]
    y = float(near[:, 1].min()) - 0.01 if len(near) else float(J["neck"][1]) - 0.05
    kv, kq = wc._blob((0.0, y, knot_z - 0.004), (0.009, 0.006, 0.013))
    self.garments.append(Garment("tie-knot", kv, kq, satin(), weights=self.nearest_weights(kv), thickness=0.0, subsurf=1))


def _skirts(self, mat):
    """The jacket below the waist: to just below the seat, close over the
    hips and falling straight; the fronts cut away from the button (in the
    material, as the lapels are). It moves with his hips, and a little with
    each thigh."""
    J = self.body.J
    arms = self.bone_weight(*_names(self, "upperarm", "lowerarm", "wrist", "finger", "metacarpal"))
    lower = self.co[self.body_idx[arms[self.body_idx] < 0.3]]
    top = self.belt_z
    zs = list(np.arange(top, self.hem_z, -0.012)) + [self.hem_z]
    cy = self.skirt_cy
    th = angles(64)
    coat_top = self.coat_V[self.coat_V[:, 2] < top + 0.03]
    rc = _radii(_hull2(coat_top[:, :2]), (0.0, cy), th) if len(coat_top) > 8 else None
    rings, prev = [], None
    for z in zs:
        hull = section(lower, z, band=0.01)
        r = prev if hull is None else _radii(hull, (0.0, cy), th)
        # Close over the hips and the seat, a little straighter below them.
        r = np.maximum(r, prev * 0.97) if prev is not None else r
        k = np.array([1.0, 2.0, 3.0, 2.0, 1.0]) / 9.0
        rr = sum(np.roll(r, i) * w for i, w in zip(range(-2, 3), k)) + 0.016
        if rc is not None and z > top - 0.06:
            # It starts just inside the jacket's body and comes out from under
            # its edge, so they meet without a step.
            f = (top - z) / 0.06
            rr = np.maximum(rr * f, rc - 0.006 + 0.008 * f) if f < 1 else np.maximum(rr, rc + 0.002)
        prev = r
        rings.append(np.stack([np.sin(th) * rr, cy - np.cos(th) * rr, np.full(len(th), z)], 1))
    V, Q = ring_grid(rings)
    W = self.nearest_weights(V, k=6)
    hips = np.zeros_like(W)
    hips[:, self.idx["spine05"]] = 1.0
    # The waist with the hips; toward the hem, a share of each thigh.
    t = np.clip((top - V[:, 2]) / max(1e-6, top - self.hem_z), 0, 1)[:, None]
    W = hips * (1 - 0.45 * t) + W * 0.45 * t
    W /= W.sum(1, keepdims=True)
    self.garments.append(Garment("jacket-skirt", V, Q, mat, weights=W.astype(F), thickness=0.004, subsurf=1))


# ── The cane ──────────────────────────────────────────────────────────────
def cane(person, length):
    """A black cane with a silver knob and ferrule: its tip at the origin, its
    shaft up +Z, `length` to the top of the knob. Parented to the figure's
    root; death_motion sets where it stands each frame."""
    col = person.col
    parts = []

    def solid(name, radii, mat, segments=20):
        # radii: [(z, r)] from the bottom up; capped at both ends.
        bm = bmesh.new()
        rings = []
        for z, r in radii:
            ring = [bm.verts.new((r * math.cos(2 * math.pi * k / segments), r * math.sin(2 * math.pi * k / segments), z)) for k in range(segments)]
            rings.append(ring)
        for a, b in zip(rings, rings[1:]):
            for k in range(segments):
                bm.faces.new((a[k], a[(k + 1) % segments], b[(k + 1) % segments], b[k]))
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
        obj = common.mesh_object(name, bm, mat, col)
        parts.append(obj)
        return obj

    knob_h = 0.05
    shaft_top = length - knob_h
    solid("death-cane-shaft", [(0.022, 0.0095), (shaft_top * 0.5, 0.0105), (shaft_top + 0.004, 0.0115)], lacquer())
    solid("death-cane-ferrule", [(0.0, 0.0088), (0.003, 0.0098), (0.024, 0.0098), (0.026, 0.0095)], silver())
    # The collar and the knob: a ball a little taller than wide, on a neck.
    prof = [(shaft_top - 0.006, 0.0119), (shaft_top + 0.002, 0.0135), (shaft_top + 0.008, 0.0129), (shaft_top + 0.012, 0.0115)]
    for k in range(1, 12):
        a = math.pi * k / 12
        prof.append((shaft_top + 0.012 + (knob_h - 0.012) * (1 - math.cos(a)) / 2, max(0.0115, 0.021 * math.sin(a) ** 0.85)))
    prof.append((length, 0.004))
    solid("death-cane-knob", prof, silver(), segments=28)
    # One object, so it moves as one.
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = "death-cane"
    for p in obj.data.polygons:
        p.use_smooth = True
    common.add_modifier(obj, "SUBSURF", levels=1, render_levels=1)
    obj.parent = person.rig.root
    obj.matrix_parent_inverse = Matrix.Identity(4)
    person.parts.append(wp.Piece(obj))
    return obj
