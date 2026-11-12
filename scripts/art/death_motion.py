"""How Death moves, frame by frame, for death_scene.py: joint rotations (in
BibleGame's figure engine's terms: world_body, world_motion), where his
cane stands, his blinks, and where he is.

The take is planned in the world, not posed joint by joint: where each foot
is set down and for how long, where the cane's tip touches the ground, where
his hips are; the legs and arms then reach for those places (two-bone IK),
so a planted foot never slides and the cane stays where it was set. His hips
ride as high as his planted legs allow, which gives a walk its rise and fall.

The take, at FPS frames a second (character space: he faces -Y, +X is his
left, +Z up; the render turns -Y to screen right):

- **walk**: a stride of CYCLE frames, looped: a man walking slowly, by the
  numbers for slow walking (a stride of a little over a metre, some 88 steps
  a minute, about two thirds of each stride on the foot), and carrying himself
  tall: chest up, shoulders back, the head over them. Each heel is set down
  with the leg straight and the toes up, and rolled flat; the body passes
  over the leg it stands on, the heel lifts and the foot pushes off from the
  ball; it swings through clear, the knee folding. The hips turn a little and
  dip toward the swinging leg; the chest turns against them; the left arm
  swings. His right fist carries the cane by its shaft under the silver knob,
  the elbow easy: it swings with the arm and its tip touches down as his left
  heel strikes, stays while he passes it, and swings through again. He
  carries it; he does not lean on it.
- **scene**, straight on from the walk: one last, shorter step, slowing; the
  trailing foot comes up beside the other; the cane is set down at his side.
  A beat. His eyes go to you first, then his head turns after them, over his
  shoulder. A beat. Then he comes round on his feet (the right foot, then
  the left), the eyes never leaving you, and the cane is set down in front
  of him; his right hand comes up onto the knob, and his left comes to rest
  on it. He breathes,
  blinks once, slowly, and his head tilts a little as he regards you. Then
  he dances (below). Then his hand leaves the cane; he turns away (his eyes the last to leave you),
  steps off and walks on: the scene ends on the stride before the looped
  one, so the walk carries him off.
- **dance**, between his regarding you and his hand leaving the cane:
  a vaudeville high-kick line, DANCE frames (7.5 s), in which he travels
  about two metres toward the walk-off; the scene after it starts from where
  it leaves him. Planned in the world, so every foot is a real plant and the
  pelvis carries the travel (`take.json` / `deathFrames.json` record it frame
  by frame, as for a walk). *The cue*: one small, sly nod, his eyes staying on
  you. *The hat*: as he nods his left hand goes behind his back and brings out
  a straw boater (death_dress.boater; one rigid object, hidden behind him
  until it is in hand), swings it out and up and sets it on his head, a little
  forward and to one side, while the cane is twirled once about his right
  hand in the plane facing you. *The turn*: he turns to profile, facing the
  way he travels (pivoting on his right foot and stepping the left on), so the
  kicks read in silhouette; the cane comes level across his chest in his
  right hand, its tip behind him, and his left hand holds the front of the
  hat's brim (a tip of the brim on every other kick). *The kick line*: eight
  kicks, R L R L ..., KP frames each (two a second). A kick is a whip, not a
  pendulum: the thigh leads with the knee bent as the foot leaves the floor,
  the knee straightens through the middle of the swing and the leg is
  straight only at the top (about as high as a very supple dancer's foot:
  head height), toe pointed, hanging a frame or two; down is faster than up,
  the knee softens, and the foot lands on its ball and then its heel. The
  pelvis tucks under and hikes on the kicking side as the leg rises; he leans
  back as a counterbalance in proportion to the height of the kick, and the
  head, the cane and the arms follow a frame or two behind the legs. The other
  leg works: the knee bends to load before each kick, straightens as it
  goes up, the heel rises onto the ball at the top, it bends to take the
  landing, and his weight goes over it before the kick leaves. One step per
  kick carries him on a step (the landing foot is set down where the pelvis
  will be over it). *The finish*: he turns back to face you (pivoting on the
  balls of both feet, then shuffling to stand), sweeps the hat off and holds
  it high in his left hand, the cane high in his right, arms wide, weight on
  his left leg, the right heel lifted, head cocked. Then he settles: the hat
  goes round behind his back and is gone (he walks off hatless, as he came),
  the cane comes back and is set down in front of him (where he now stands),
  his hands go back on it, and the scene goes on as before. Every pose is
  eased in and out.
"""
import math

import numpy as np

import makehuman as mh
import world_body as wb
import world_cloth as wc
import world_motion as wm
from world_body import rot

FPS = 20
CYCLE = 27
# The camera looks down at him by this much (death_scene.py).
TILT = 8.0
# The dance (see the docstring): its length in frames, a beat every BEAT.
DANCE = 151
BEAT = 10

# How far one stride carries him (m), in CYCLE frames: a man walking slowly
# (about 0.8 m/s: a stride of a little over a metre, some 88 steps a minute).
STRIDE = 1.05
# How a foot meets the ground walking: the heel set down with the leg
# straight and the toes up, rolled flat; the heel lifting as the body passes
# over it, pushing off from the ball; swung through clear of the ground,
# highest early in the swing as the knee folds.
WALK_FOOT = dict(hs=-14.0, to=30.0, lift=0.055)


def ease(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def smoother(t):
    t = min(1.0, max(0.0, t))
    return t * t * t * (t * (6 * t - 15) + 10)


def bump(t, a=0.0, b=1.0):
    """0 outside [a, b]; a smooth hump (peak 1) inside."""
    if t <= a or t >= b:
        return 0.0
    return math.sin(math.pi * (t - a) / (b - a)) ** 2


def keyed(keys):
    """A smooth curve through [(t, value)] (value a number or a vector): cubic
    Hermite, its slope at each key the mean of the two sides, but flat at a
    peak, a trough or a hold, so it never overshoots a pose it is meant to
    hold. Flat before the first key and after the last."""
    ts = np.array([k[0] for k in keys], float)
    vs = np.array([np.asarray(k[1], float) for k in keys])
    m = np.zeros_like(vs)
    for i in range(1, len(ts) - 1):
        a, b = vs[i] - vs[i - 1], vs[i + 1] - vs[i]
        m[i] = np.where(a * b > 0, (vs[i + 1] - vs[i - 1]) / (ts[i + 1] - ts[i - 1]), 0.0)

    def f(t):
        if t <= ts[0]:
            return vs[0].copy()
        if t >= ts[-1]:
            return vs[-1].copy()
        i = int(np.searchsorted(ts, t, side="right") - 1)
        h = ts[i + 1] - ts[i]
        u = (t - ts[i]) / h
        return (2 * u**3 - 3 * u**2 + 1) * vs[i] + (u**3 - 2 * u**2 + u) * h * m[i] + (-2 * u**3 + 3 * u**2) * vs[i + 1] + (u**3 - u**2) * h * m[i + 1]

    return f


def unit(v):
    v = np.asarray(v, float)
    return v / np.linalg.norm(v)


def lerp(a, b, t):
    return np.asarray(a, float) * (1 - t) + np.asarray(b, float) * t


def yaw(deg):
    return rot(z=deg)


def _after(R, bone, extra):
    """Add a rotation (character axes) on top of what a bone already has."""
    R[bone] = extra @ R.get(bone, np.eye(3))


class Plant:
    """A foot set down at `F` (where the ankle is, x y, when the foot is
    flat), turned `turn` degrees: struck at t0 with the toes up `hs` degrees
    (negative), flat at t1, the heel rising from t2 to `to` degrees at t3,
    when it lifts. `lift` is how high the swing that brings it here rises."""

    def __init__(self, F, turn, t0, t1, t2, t3, hs=-14.0, to=32.0, lift=0.05, fn=None, air=False, kick=None, extra=None):
        self.F = np.asarray(F, float)
        self.turn, self.t0, self.t1, self.t2, self.t3 = turn, t0, t1, t2, t3
        self.hs, self.to, self.lift = hs, to, lift
        # The dance's feet: `fn` gives the pitch while it stands (on the ball
        # of the foot, say); `air` keeps the toes bent in the swing before it;
        # `kick` (peak, ankle path, toe pitch) makes that swing a kick; `extra`
        # adds to the pitch while it stands (rising onto the ball as the other
        # leg kicks).
        self.fn, self.air, self.kick, self.extra = fn, air, kick, extra

    def pitch(self, t):
        return self._pitch(t) + (self.extra(t) if self.extra is not None else 0.0)

    def _pitch(self, t):
        if self.fn is not None:
            return self.fn(t)
        if t < self.t1:
            return self.hs * (1 - ease((t - self.t0) / max(1e-6, self.t1 - self.t0)))
        if t < self.t2:
            return 0.0
        return self.to * ease((t - self.t2) / max(1e-6, self.t3 - self.t2)) ** 1.3


class Motion:
    def __init__(self, person, sole):
        b = person.bodyd
        self.tails = b.tails
        self.p = person
        self.sk, self.heads, self.J, self.H = b.sk, b.heads, b.J, b.height
        self.idx = self.sk.index
        self.co = b.co
        self.W = self.sk.W
        self.sole = sole
        h, i = self.heads, self.idx
        self.Jp = np.asarray(self.J["pelvis"], float)
        base = mh.Base.get()
        body = base.verts_of("body")
        low = body[self.co[body, 2] < 0.015]
        self.legs = {}
        for s in "LR":
            cols = [i[n] for n in self.sk.names if n.startswith(("foot.", "toe")) and n.endswith("." + s)]
            soles = low[self.W[low][:, cols].sum(1) > 0.5]
            H0, K0, A0 = h[i[f"upperleg01.{s}"]], h[i[f"lowerleg01.{s}"]], h[i[f"foot.{s}"]]
            pts = self.co[soles]
            heel_y = float(pts[:, 1].max()) - 0.01
            ball_y = float(np.mean([h[i[f"toe{t}-1.{s}"]][1] for t in (1, 2, 3, 4)]))
            self.legs[s] = dict(
                a=float(np.linalg.norm(K0 - H0)),
                b=float(np.linalg.norm(A0 - K0)),
                A0=A0,
                hv=np.array([0.0, heel_y - A0[1], -A0[2]]),
                bv=np.array([0.0, ball_y - A0[1], -A0[2]]),
                stand=A0[:2] - self.Jp[:2],
                hip=H0,
            )
        self.hand0 = {s: self._hand_frame(s) for s in "LR"}
        self.arm = {}
        for s in "LR":
            S0, E0, W0 = h[i[f"upperarm01.{s}"]], h[i[f"lowerarm01.{s}"]], h[i[f"wrist.{s}"]]
            self.arm[s] = (float(np.linalg.norm(E0 - S0)), float(np.linalg.norm(W0 - E0)))
        hf = self.hand0["R"]
        reach = sum(self.arm["R"]) + float(np.linalg.norm(hf["pc"] - hf["wrist"]))
        shoulder = h[i["upperarm01.R"]]
        # The cane: carried, not leaned on. His fist round it under the knob at
        # the height his hand hangs, the elbow a little bent.
        self.L = round(float(self.J["hand_R"][2]) + sole + 0.09, 3)
        _ = reach
        # Where it stands, and where his hand is, from his hips (x across, y back).
        self.cane_x = float(self.J["hip_R"][0]) - 0.14 - float(self.Jp[0])
        self.hand_y = float(shoulder[1]) - float(self.Jp[1]) + 0.01
        self.d = STRIDE

    # ── the skeleton ──────────────────────────────────────────────────────
    def fk(self, R, root):
        return wb.forward(self.sk, self.heads, R, root)

    def at(self, D, bone, p):
        return (D[self.idx[bone]] @ np.append(np.asarray(p, float), 1.0))[:3]

    def _hand_frame(self, s):
        h, i = self.heads, self.idx
        w = h[i[f"wrist.{s}"]]
        k = h[i[f"finger3-1.{s}"]]
        f = unit(k - w)
        a = h[i[f"finger2-1.{s}"]] - h[i[f"finger5-1.{s}"]]
        a = unit(a - (a @ f) * f)
        n = np.cross(f, a)
        # Hanging at his side, the palm faces his thigh.
        inward = np.array([-np.sign(w[0]), 0.0, 0.0])
        return dict(M0=np.column_stack([f, a, n]), sign=1.0 if n @ inward > 0 else -1.0, wrist=w, pc=(w + k) / 2)

    def fingers(self, R, s, curl):
        """His fingers drawn together (the body's rest pose fans them out like
        a starfish) and curled `curl` (0 open, 1 a fist), the thumb tucked
        toward the index finger."""
        h, tl, i = self.heads, self.tails, self.idx
        d = {f: unit(tl[i[f"finger{f}-1.{s}"]] - h[i[f"finger{f}-1.{s}"]]) for f in range(1, 6)}
        sg = 1.0 if s == "L" else -1.0
        for f in range(1, 6):
            if f == 1:
                together = wb.between(d[1], unit(0.55 * d[1] + 0.45 * d[2]))
            elif f == 3:
                together = np.eye(3)
            else:
                together = wb.between(d[f], unit(0.3 * d[f] + 0.7 * d[3]))
            for k in range(1, 4):
                bone = f"finger{f}-{k}.{s}"
                if f == 1:
                    c = rot(y=sg * 18.0 * curl if k == 1 else 0.0, x=-22.0 * curl)
                else:
                    c = rot(y=sg * (30.0 if k == 1 else 42.0) * curl)
                R[bone] = c @ together if k == 1 else c
        return R

    def spread(self, R, s, a):
        """Open the hand's fingers `a` of the way to the body's rest pose (fanned)."""
        if a <= 0.0:
            return R
        for f in range(1, 6):
            for k in range(1, 4):
                bone = f"finger{f}-{k}.{s}"
                U, _, Vt = np.linalg.svd((1 - a) * R.get(bone, np.eye(3)) + a * np.eye(3))
                R[bone] = U @ Vt
        return R

    def relax_hand(self, R, root, s, curl=0.4, flex=10.0):
        """A hand hanging at ease: in line with the forearm, bent a little
        toward the palm, the palm facing his thigh, fingers together and
        softly curled."""
        D = self.fk(R, root)
        E = self.at(D, f"lowerarm01.{s}", self.heads[self.idx[f"lowerarm01.{s}"]])
        Wr = self.at(D, f"wrist.{s}", self.heads[self.idx[f"wrist.{s}"]])
        fore = unit(Wr - E)
        side = 1.0 if s == "L" else -1.0
        medial = -side * root[:3, 0]
        palm = unit(medial - (medial @ fore) * fore)
        a = math.radians(flex)
        fingers = unit(fore * math.cos(a) + palm * math.sin(a))
        G = self.hand_turn(s, fingers, palm)
        R[f"wrist.{s}"] = D[self.sk.parent[self.idx[f"wrist.{s}"]]][:3, :3].T @ G
        return self.fingers(R, s, curl)

    def hand_turn(self, s, fingers, palm):
        """The rotation (rest -> posed) that points a hand's fingers along
        `fingers` with its palm facing `palm`."""
        hf = self.hand0[s]
        n1 = hf["sign"] * unit(palm)
        f = np.asarray(fingers, float)
        f1 = unit(f - (f @ n1) * n1)
        a1 = np.cross(n1, f1)
        return np.column_stack([f1, a1, n1]) @ hf["M0"].T

    def hand_dirs(self, R, root, s):
        """(fingers, palm): which way a hand's fingers point and its palm faces."""
        hf = self.hand0[s]
        G = self.fk(R, root)[self.idx[f"wrist.{s}"]][:3, :3]
        return G @ hf["M0"][:, 0], G @ (hf["sign"] * hf["M0"][:, 2])

    def palm_of(self, R, root, s):
        return self.at(self.fk(R, root), f"wrist.{s}", self.hand0[s]["pc"])

    def _two_bone(self, R, root, upper, mid, end, S, target, a, b, pole):
        d = target - S
        c = float(np.clip(np.linalg.norm(d), abs(a - b) + 1e-3, a + b - 1e-4))
        dh = unit(d)
        cos_a = (a * a + c * c - b * b) / (2 * a * c)
        sin_a = math.sqrt(max(0.0, 1 - cos_a * cos_a))
        pole = np.asarray(pole, float)
        n = unit(pole - (pole @ dh) * dh)
        E = S + a * (cos_a * dh + sin_a * n)
        wb.aim(self.sk, self.heads, R, upper, mid, E - S, root)
        wb.aim(self.sk, self.heads, R, mid, end, S + c * dh - E, root)

    def reach(self, R, root, s, palm_at, fingers, palm, pole):
        """Put the middle of the palm of hand `s` at `palm_at`, turned as
        `hand_turn` says, the elbow toward `pole`."""
        hf = self.hand0[s]
        G = self.hand_turn(s, fingers, palm)
        target = np.asarray(palm_at, float) - G @ (hf["pc"] - hf["wrist"])
        D = self.fk(R, root)
        S = self.at(D, f"upperarm01.{s}", self.heads[self.idx[f"upperarm01.{s}"]])
        self._two_bone(R, root, f"upperarm01.{s}", f"lowerarm01.{s}", f"wrist.{s}", S, target, *self.arm[s], pole)
        D = self.fk(R, root)
        R[f"wrist.{s}"] = D[self.sk.parent[self.idx[f"wrist.{s}"]]][:3, :3].T @ G
        return R

    def step(self, R, root, s, ankle, G, toe, knee):
        """Put foot `s`'s ankle at `ankle`, the foot turned G (rest -> posed),
        its toes bent `toe` degrees (to stay on the ground as the heel rises),
        the knee toward `knee`."""
        leg = self.legs[s]
        D = self.fk(R, root)
        S = self.at(D, f"upperleg01.{s}", leg["hip"])
        self._two_bone(R, root, f"upperleg01.{s}", f"lowerleg01.{s}", f"foot.{s}", S, np.asarray(ankle, float), leg["a"], leg["b"], knee)
        D = self.fk(R, root)
        R[f"foot.{s}"] = D[self.sk.parent[self.idx[f"foot.{s}"]]][:3, :3].T @ G
        for t in range(1, 6):
            R[f"toe{t}-1.{s}"] = rot(x=-toe)
        return R

    # ── feet ──────────────────────────────────────────────────────────────
    def foot_pose(self, s, F, turn, pitch):
        """(ankle, rotation) for foot s flat at F turned `turn`, pitched
        `pitch` degrees (+ heel up about the ball, - toes up about the heel)."""
        leg = self.legs[s]
        Ry = yaw(turn)
        Rp = rot(x=pitch)
        flat = np.array([F[0], F[1], leg["A0"][2] + self.sole])
        piv = leg["bv"] if pitch >= 0 else leg["hv"]
        return flat + Ry @ piv - Ry @ Rp @ piv, Ry @ Rp

    def foot_at(self, s, plants, t):
        """(ankle, rotation, toe bend, on the ground) for foot s at time t."""
        if t <= plants[0].t3:
            pl = plants[0]
            if t < pl.t0:
                t = pl.t0
            th = pl.pitch(t)
            A, G = self.foot_pose(s, pl.F, pl.turn, th)
            return A, G, max(th, 0.0), True
        for k in range(1, len(plants)):
            prev, pl = plants[k - 1], plants[k]
            if t < pl.t0:
                u = (t - prev.t3) / (pl.t0 - prev.t3)
                e = smoother(u)
                A0, _ = self.foot_pose(s, prev.F, prev.turn, prev.to)
                A1, _ = self.foot_pose(s, pl.F, pl.turn, pl.hs)
                A = lerp(A0, A1, e)
                A[2] += pl.lift * math.sin(math.pi * u**0.75)
                th = prev.to + (pl.hs - prev.to) * smoother(min(1.0, u * 1.25))
                turn = prev.turn + (pl.turn - prev.turn) * e
                if pl.kick is not None:
                    peak, arc, k_pitch, w_of = pl.kick
                    w = w_of(t)
                    A = lerp(A, arc(t), w)
                    th = th + (k_pitch(t) - th) * w
                return A, yaw(turn) @ rot(x=th), (max(th, 0.0) if (pl.air or prev.air) else 0.0), False
            if t <= pl.t3:
                th = pl.pitch(t)
                A, G = self.foot_pose(s, pl.F, pl.turn, th)
                return A, G, max(th, 0.0), True
        pl = plants[-1]
        A, G = self.foot_pose(s, pl.F, pl.turn, 0.0)
        return A, G, 0.0, True

    # ── the take ──────────────────────────────────────────────────────────
    def take(self):
        """Every frame, for the renders: [{R, root, cane, blink, hips, rec}].
        `hips` is where his hips are along his way (he walks toward -y);
        `rec` labels a frame to be rendered: ("walk", k) for the looped
        stride, ("scene", k) for what comes between his walking in and his
        walking off."""
        C, d = CYCLE, self.d
        v = d / C
        legs = self.legs
        stand = {s: legs[s]["stand"] for s in "LR"}
        X0, Y0 = 0.0, 3.0
        tw = 10.0  # he sets off (before it: the walk's first frame, held)
        ts = tw + 3 * C  # the last step begins (a left heel strike)

        # ── Where his hips go: walking in, slowing to a stop, standing,
        # setting off again and walking away.
        F_L4 = np.array([X0 + stand["L"][0], Y0 - v * (ts - tw) - 0.31 * d + stand["L"][1]])
        F_R5 = np.array([X0 + stand["R"][0], F_L4[1] - 0.3])
        Ye = F_R5[1] - stand["R"][1]
        Ys = Y0 - v * (ts - tw)
        te = ts + 2 * (Ys - Ye) / v
        P_end = np.array([X0, Ye])
        # The scene's beats (frames).
        t_eyes = te + 8
        t_turn = t_eyes + 28
        nF = 36
        t_hands = t_turn + nF
        nG = 24
        t_regard = t_hands + nG
        nH = 40
        t_dance = t_regard + nH  # he has regarded you; the dance begins
        t_release = t_dance + DANCE
        nI = 14
        t_back = t_release + nI
        nJ = 34
        t_go = t_back + nJ - 8  # his left foot leaves before he has quite come round
        t_s2 = t_go + 0.55 * C  # ...and strikes: the first stride of his going
        t_acc = t_s2 + 0.35 * C
        t_end = t_s2 + C

        def hips_y(t):
            if t <= ts:
                return Y0 - v * (t - tw)
            if t < te:
                u, T = (t - ts) / (te - ts), te - ts
                return (2 * u**3 - 3 * u**2 + 1) * Ys + (u**3 - 2 * u**2 + u) * (-v * T) + (-2 * u**3 + 3 * u**2) * Ye
            if t <= t_go:
                return Ye
            if t < t_acc:
                return Ye - v * (t - t_go) ** 2 / (2 * (t_acc - t_go))
            return Ye - v * (t_acc - t_go) / 2 - v * (t - t_acc)

        # What the dance does to where he stands: the rest of the scene is shifted along by it.
        _hy0 = hips_y
        dsh = {"t": 1e18, "y": 0.0}

        def hips_y(t):
            return _hy0(t) + (dsh["y"] if t > dsh["t"] else 0.0)

        def pace(t):
            """How fast he is walking, as a share of his stride's pace."""
            return max(0.0, min(1.0, (_hy0(t - 0.5) - _hy0(t + 0.5)) / v))

        def phase(t):
            return ((t - tw) / C) % 1.0 if t < te else ((t - t_s2) / C) % 1.0

        # ── His feet.
        def stride_plant(s, t0, **kw):
            # Walking, the feet land a little nearer the line he walks along.
            F = (X0 + 0.85 * stand[s][0], hips_y(t0 + 0.31 * C) + stand[s][1])
            return Plant(F, 0.0, t0, t0 + 0.1 * C, t0 + 0.32 * C, t0 + 0.62 * C, **{**WALK_FOOT, **kw})

        plants = {"L": [], "R": []}
        for k in range(-1, 3):
            plants["L"].append(stride_plant("L", tw + k * C))
            plants["R"].append(stride_plant("R", tw + k * C + C / 2))
        Rq = yaw(-90.0)[:2, :2]
        r_turn0, r_turn1 = t_turn + 0.06 * nF, t_turn + 0.46 * nF
        l_turn0, l_turn1 = t_turn + 0.5 * nF, t_turn + 0.92 * nF
        r_back0, r_back1 = t_back + 0.1 * nJ, t_back + 0.55 * nJ
        # The last steps: left as usual; right short and slowing; left up beside it.
        plants["L"].append(Plant(F_L4, 0.0, ts, ts + 0.15 * C, ts + 0.5 * C, ts + 0.72 * C, hs=-8.0, to=14.0, lift=0.03))
        plants["R"].append(Plant(F_R5, 0.0, ts + 0.6 * C, ts + 0.72 * C, r_turn0 - 3, r_turn0, hs=-6.0, to=8.0, lift=0.03))
        plants["L"].append(Plant(P_end + stand["L"], 0.0, ts + 1.12 * C, ts + 1.2 * C, l_turn0 - 3, l_turn0, hs=-3.0, to=8.0, lift=0.03))
        # Coming round to face you: each foot lifted, turned and set down.
        plants["R"].append(Plant(P_end + Rq @ stand["R"], -90.0, r_turn1, r_turn1 + 2, r_back0 - 3, r_back0, hs=-3.0, to=8.0, lift=0.03))
        plants["L"].append(Plant(P_end + Rq @ stand["L"], -90.0, l_turn1, l_turn1 + 2, t_go - 3, t_go, hs=-3.0, to=10.0, lift=0.03))
        # Turning away: the right foot comes round, and the left steps off.
        plants["R"].append(Plant(P_end + stand["R"], 0.0, r_back1, r_back1 + 2, t_s2 + 0.44 * C - C / 2, t_s2 + 0.66 * C - C / 2, hs=-3.0, lift=0.03))
        for k in range(0, 3):
            plants["L"].append(stride_plant("L", t_s2 + k * C, lift=0.036 if k else 0.04))
            plants["R"].append(stride_plant("R", t_s2 + k * C + C / 2))

        # ── The dance: a vaudeville high-kick line, DANCE frames from t_dance.
        # tau is the frame within it; the beat is BEAT frames. He nods, twirls
        # the cane, turns to profile and kicks his way across the floor (a kick
        # every KP frames, the leg straight and swung up nearly vertical, one
        # step carrying him on between kicks), turns back to you, flings his
        # arms wide, and settles on the cane.
        D0 = float(t_dance)
        LEG = {s: legs[s]["a"] + legs[s]["b"] for s in "LR"}
        sig = {"L": 1.0, "R": -1.0}
        FV = np.array([0.0, -1.0])  # the way he travels (world x y): toward the walk-off
        T_NOD, T_LIFT0, T_TW0, T_TW1 = 3.0, 5.0, 8.0, 18.0
        T_T0 = 20.0  # he starts to turn to profile
        KP, NK = 10.0, 8
        T_K0 = 30.0  # the first kick
        T_K1 = T_K0 + KP * NK  # the last foot comes down
        T_B1 = T_K1 + 10.0  # he has turned back to you
        T_FIN, T_FIN_END = T_B1 + 1.0, T_B1 + 16.0  # arms flung wide ... held
        T_END = float(DANCE)
        BETA = 148.0  # how far a kicking leg swings from hanging (degrees): about as high as a very supple dancer's foot (head height)
        STEP = 0.27  # how far each step carries him (m)
        V = STEP / KP
        SB = 0.55  # (a kicker's feet are set nearer the line he travels along)

        def sp(s):
            return np.array([SB * stand[s][0], stand[s][1]])

        def tp(s, dx=0.0, dy=0.0):
            """Where foot s's ankle is set down, from where it stands at rest."""
            return P_end + Rq @ (stand[s] + np.array([dx, dy]))

        def bvv(s):
            return self.legs[s]["bv"][:2]

        def pl3(F, a, b, c, d, turn=0.0, **kw):
            kw.setdefault("lift", 0.05)
            return Plant(F, turn, D0 + a, D0 + b, D0 + c, D0 + d, air=True, **kw)

        # Where he is turned: -90 facing you, 0 in profile (toward the walk-off).
        def d_turn_in(tau):
            return smoother((tau - (T_T0 + 1.0)) / (T_K0 - T_T0 - 2.0))

        def d_turn_out(tau):
            return smoother((tau - (T_K1 + 1.0)) / (T_B1 - T_K1 - 2.0))

        def d_psi(tau):
            return 90.0 * d_turn_in(tau) * (1.0 - d_turn_out(tau))

        # The feet he starts the kicks from: turned on the balls, which stay where they were.
        B0 = {s: tp(s) + Rq @ bvv(s) for s in "LR"}
        F_PROF = {s: B0[s] - bvv(s) for s in "LR"}
        # He stands on the left to begin with; his pelvis is over it, and travels at STEP a kick.
        # (He turns on his right foot and steps the left on ahead of where he
        # stands; the pelvis stays put until the kicks carry it.)
        mid0 = np.array([P_end[0], P_end[1] - V * KP * 0.5])
        y_start = mid0[1] + V * (T_K0 + KP * 0.5 - T_K0)
        F_L0 = mid0 + sp("L")

        def pel_lin(tau, xb):
            """His pelvis along the kick line: steady travel, a lateral drift to xb."""
            e = (tau - (T_K0 + KP * 0.5)) / (T_K1 - T_K0)
            return np.array([mid0[0] + (xb - mid0[0]) * e, y_start - V * (tau - T_K0)])

        def fin_feet(xb):
            """Where his feet end the line, and the post-turn pelvis P1."""
            FL = pel_lin(T_K1 + KP * 0.5, xb) + sp("L")
            FR = pel_lin(T_K0 + KP * (NK - 1) + KP * 0.5, xb) + sp("R")
            Fp = {"L": FL, "R": FR}
            Fq = {s: Fp[s] + bvv(s) - Rq @ bvv(s) for s in "LR"}
            P1_ = 0.5 * ((Fq["L"] - Rq @ stand["L"]) + (Fq["R"] - Rq @ stand["R"]))
            return Fp, Fq, P1_

        xb = mid0[0]
        _, _, P1_try = fin_feet(xb)
        xb = xb + (X0 - P1_try[0])
        F_END, F_Q, P1 = fin_feet(xb)
        DTR = float(P_end[1] - P1[1])
        dsh["t"], dsh["y"] = D0 + T_END, -DTR

        def pelvis(tau):
            """His pelvis (world x y) through the dance."""
            if tau <= T_T0:
                return P_end.copy()
            if tau < T_K0:
                e = smoother((tau - T_T0) / (T_K0 - T_T0))
                return lerp(P_end, pel_lin(T_K0, xb), e)
            if tau <= T_K1:
                return pel_lin(tau, xb)
            end_k = pel_lin(T_K1, xb)
            hold = pel_lin(T_K1 + KP * 0.5, xb)
            k = keyed([(T_K1, end_k), (T_B1 + 3.0, P1), (T_END, P1)])
            return k(tau)

        def d_ln(tau):
            """How far he leans back through the kick line (0 to 1)."""
            return smoother((tau - (T_K0 - 6.0)) / 6.0) * (1.0 - smoother((tau - (T_K1 - 1.0)) / 7.0))

        # One kick (u, 0 to 1 over KP frames): the thigh leads with the knee bent, the
        # knee straightens through the middle of the swing, the leg is straight only at
        # the top; a hang of a frame or two; then down faster, the knee softening, and the
        # foot lands on its ball, the heel following.
        ALPHA = keyed([(0.0, 6.0), (0.1, 24.0), (0.25, 82.0), (0.38, 138.0), (0.46, BETA), (0.6, BETA), (0.7, 100.0), (0.84, 42.0), (0.97, 10.0)])
        KNEE = keyed([(0.0, 6.0), (0.1, 36.0), (0.25, 38.0), (0.38, 12.0), (0.46, 0.0), (0.6, 0.0), (0.7, 20.0), (0.84, 30.0), (0.97, 16.0)])
        TOE = keyed([(0.0, 22.0), (0.1, 26.0), (0.25, 2.0), (0.4, -34.0), (0.46, -50.0), (0.6, -50.0), (0.7, -12.0), (0.84, 12.0), (0.97, 24.0)])
        WARC = keyed([(0.0, 0.0), (0.1, 1.0), (0.84, 1.0), (0.97, 0.0)])

        def kick_lift(tau):
            """How high the kick in progress is (0 to 1; 0 between kicks)."""
            i = int(math.floor((tau - T_K0) / KP))
            if i < 0 or i >= NK:
                return 0.0
            return float(ALPHA((tau - T_K0 - KP * i) / KP)) / BETA

        def kick_side(tau):
            """+1 while the right foot kicks, -1 for the left."""
            i = int(math.floor((tau - T_K0) / KP))
            return 1.0 if i % 2 == 0 else -1.0

        def d_sink(tau):
            """How far his knees give (m): the standing knee bends to load before
            each kick, straightens as the leg goes up, and bends again to take the landing."""
            if tau < 0.0 or tau > T_END:
                return 0.0
            z = 0.0
            ramp = smoother((tau - (T_K0 - 4.0)) / 4.0) * (1.0 - smoother((tau - (T_K1 + 2.0)) / 4.0))
            if ramp > 0.0:
                z += ramp * 0.07 * (1.0 - min(1.0, max(0.0, kick_lift(tau)))) ** 1.3
            z += 0.02 * smoother((tau - T_B1) / 4.0) * (1.0 - smoother((tau - T_FIN_END) / 5.0))
            return z

        def d_tilt(tau):
            """How far his pelvis tucks under (degrees): a little through the line, more as each leg rises."""
            return 8.0 * d_ln(tau) + 8.0 * kick_lift(tau) * d_ln(tau)

        def d_hike(tau):
            """His pelvis hikes on the kicking side (roll, degrees)."""
            return 4.0 * kick_lift(tau) * kick_side(tau) * d_ln(tau)

        def d_lat(tau):
            """His weight goes over the standing foot before the kick leaves (m, across)."""
            z = 0.0
            for i in range(NK):
                s_ = T_K0 + KP * i
                z += (-1.0 if i % 2 == 0 else 1.0) * -0.045 * bump(tau, s_ - 3.0, s_ + KP - 1.0)
            return z

        # His feet. Turned to profile on the balls of the feet, each a ball plant.
        def pivot(s, tau, B, a0, a1, ta, tb):
            frac = smoother((tau - ta) / (tb - ta))
            turn = a0 + (a1 - a0) * frac
            F = B - yaw(turn)[:2, :2] @ bvv(s)
            pitch = 14.0 * bump(tau, ta - 1.5, tb + 1.0)
            A, G = self.foot_pose(s, F, turn, pitch)
            return A, G, max(pitch, 0.0), True

        # The kicks: R L R L ... The standing foot is the other; a kicking foot lands
        # where the pelvis will be over it, one step on.
        def heel_up(t):
            """The standing heel comes up onto the ball as the other leg reaches its height."""
            return 22.0 * max(0.0, min(1.0, (kick_lift(t - D0) - 0.35) / 0.55))

        kl = {"L": [], "R": []}
        kl["R"].append(Plant(F_PROF["R"], 0.0, -1e3, -1e3 + 1, D0 + T_K0 - 1.5, D0 + T_K0, hs=0.0, to=8.0, air=True))
        kl["L"].append(Plant(tp("L"), -90.0, -1e3, -1e3 + 1, D0 + T_T0 - 0.5, D0 + T_T0 + 1.5, hs=0.0, to=8.0, air=True))
        kl["L"].append(pl3(F_L0, T_K0 - 3.0, T_K0 - 1.5, T_K0 + KP - 1.5, T_K0 + KP, turn=0.0, hs=-3.0, to=8.0, extra=heel_up))
        hz0 = {s: legs[s]["A0"][2] + self.sole for s in "LR"}
        for i in range(NK):
            K = "R" if i % 2 == 0 else "L"
            s_ = T_K0 + KP * i
            a_, b_ = legs[K]["a"], legs[K]["b"]
            hoff = legs[K]["hip"][:2] - self.Jp[:2]

            def arc(t, K=K, s_=s_, a_=a_, b_=b_, hoff=hoff):
                tau = t - D0
                u = (tau - s_) / KP
                al = math.radians(float(ALPHA(u)))
                sh = math.radians(float(ALPHA(u)) - float(KNEE(u)))
                pel = pelvis(tau)
                hz = hz0[K] + 0.97 * LEG[K] - d_sink(tau) + 0.02 * kick_lift(tau)
                xy = pel + hoff + FV * (a_ * math.sin(al) + b_ * math.sin(sh))
                return np.array([xy[0], xy[1], hz - a_ * math.cos(al) - b_ * math.cos(sh)])

            land = s_ + KP - 0.5
            F_land = pel_lin(s_ + KP * 1.5, xb) + sp(K)
            nxt = s_ + 2 * KP
            leave = nxt if i + 2 < NK else 1e5
            plant = pl3(F_land, land, land + 2.5, leave - 1.5, leave, hs=24.0, to=8.0, extra=heel_up, kick=(D0 + s_ + 0.5 * KP, arc, lambda t, s_=s_: float(TOE((t - D0 - s_) / KP)), lambda t, s_=s_: float(WARC((t - D0 - s_) / KP))))
            kl[K].append(plant)
        # After the last kick, and the turn, his feet are where the pivots put them.
        post = {
            "L": [Plant(F_Q["L"], -90.0, -1e3, -1e3 + 1, D0 + T_B1 + 3.5, D0 + T_B1 + 5.0, hs=0.0, to=8.0, air=True), pl3(P1 + Rq @ stand["L"], T_B1 + 6.5, T_B1 + 8.0, 1e6, 1e6 + 1, turn=-90.0, hs=-3.0, to=8.0)],
            "R": [
                Plant(F_Q["R"], -90.0, -1e3, -1e3 + 1, D0 + T_B1 + 0.5, D0 + T_B1 + 1.5, hs=0.0, to=8.0, air=True),
                pl3(P1 + Rq @ (stand["R"] + np.array([-0.20, 0.10])), T_B1 + 3.0, T_B1 + 4.5, T_FIN_END + 1.0, T_FIN_END + 2.0, turn=-90.0, hs=34.0, to=34.0, fn=lambda t: 34.0),
                pl3(P1 + Rq @ stand["R"], T_END - 4.0, T_END - 2.0, 1e6, 1e6 + 1, turn=-90.0, hs=-3.0, to=8.0),
            ],
        }
        # (the plants after the dance, where it leaves him)
        plants["R"][5].t2, plants["R"][5].t3 = D0 - 2.0, D0
        plants["L"][6].t2, plants["L"][6].t3 = D0 - 2.0, D0
        plants["L"].insert(7, Plant(P1 + Rq @ stand["L"], -90.0, D0 + T_END - 2.0, D0 + T_END, t_go - 3, t_go, hs=-3.0, to=10.0, lift=0.03))
        plants["R"].insert(6, Plant(P1 + Rq @ stand["R"], -90.0, D0 + T_END - 2.0, D0 + T_END, r_back0 - 3, r_back0, hs=-3.0, to=8.0, lift=0.03))

        def foot_state(s, t):
            tau = t - D0
            if tau < 0.0 or t > D0 + T_END:
                return self.foot_at(s, plants[s], t)
            if tau < T_K0:
                if s == "L":
                    return self.foot_at(s, kl[s], t)
                return pivot(s, tau, B0[s], -90.0, 0.0, T_T0 + 1.0, T_K0 - 1.0)
            if tau < T_K1:
                return self.foot_at(s, kl[s], t)
            if tau <= T_B1:
                return pivot(s, tau, F_END[s] + bvv(s), 0.0, -90.0, T_K1 + 1.0, T_B1 - 1.0)
            return self.foot_at(s, post[s], t)

        def d_yaw(tau):
            return d_psi(tau)

        def d_roll(tau):
            return 0.0

        def d_twist(tau):
            return 0.0

        # The cane in his right hand, on his body's own axes (x across, y back,
        # z up; from his pelvis, turned with him). Described by the point on the
        # shaft his hand is at (G), the way the shaft points (u, from the tip
        # toward the knob) and how far below the knob his hand is.
        C_TW = np.array([-0.38, -0.32, 1.08])
        G_KC, U_KC, S_KC = np.array([-0.34, -0.12, 1.22]), unit([0.0, -0.95, 0.18]), 0.02
        F_KC, N_KC = np.array([1.0, 0.0, 0.0]), np.array([0.0, 0.0, -1.0])  # (fingers, palm) round the level cane
        G_FIN, U_FIN = np.array([-0.52, -0.05, 1.62]), unit([0.10, 0.0, -0.99])
        T_TO = T_K0 - 2.0  # the cane is across his chest by here

        def cane_dance(tau):
            """(G, u, s_g, u_hand, share of the level-cane grip): the dance's cane."""
            if tau < T_TW1:
                th = 2 * math.pi * smoother((tau - T_TW0) / (T_TW1 - T_TW0))
                u = np.array([-math.sin(th), 0.0, math.cos(th)])
                sgd = float(keyed([(T_LIFT0, 0.0), (T_TW0, 0.04), (T_TW0 + 3.0, 0.33), (T_TW1, 0.33)])(tau))
                G = C_TW.copy()
                G[2] = C_TW[2] - 0.12 * (1.0 - smoother((tau - T_LIFT0) / 4.0))
                return G, u, sgd, unit([0.0, 0.0, 1.0]), 0.0
            if tau < T_FIN - 8.0:
                e = smoother((tau - T_TW1) / (T_TO - T_TW1))
                u = unit(lerp([0.0, 0.0, 1.0], U_KC, e))
                G = lerp(C_TW, G_KC, e)
                pump = max(0.0, kick_lift(tau - 1.5)) ** 1.5 * d_ln(tau)
                G = G + np.array([0.0, -0.025, 0.06]) * pump * e
                hk = smoother((tau - T_TW1) / (T_TO - T_TW1)) * (1.0 - smoother((tau - (T_B1 - 7.0)) / 5.0))
                return G, u, 0.33 + (S_KC - 0.33) * e, u, hk
            e = smoother((tau - (T_FIN - 8.0)) / 8.0)
            u = unit(lerp(U_KC, U_FIN, e))
            G = lerp(G_KC, G_FIN, e)
            sgd = S_KC + (0.20 - S_KC) * e
            if tau > T_FIN:
                G = G + np.array([0.0, 0.0, 0.015 * math.sin(2 * math.pi * (tau - T_FIN) / 14.0)])
            return G, u, sgd, u, 0.0

        def wc_cane(tau):
            """How much of the cane is the dance's: it leaves the ground as his
            hand lifts it, and comes back to be set down at the end."""
            return smoother((tau - 3.0) / 5.0) * (1.0 - smoother((tau - T_FIN_END) / (T_END - T_FIN_END - 1.0)))

        # His left hand: on his right, then up to his brow (tipping the brim he
        # hasn't got) through the kicks, flung wide at the finish; back on the cane.
        FIN_L = (np.array([0.56, -0.06, 1.70]), unit([0.6, -0.1, 0.8]), np.array([0.0, -1.0, 0.0]))

        # His boater. Worn, it sits on his head (a little forward and to one side,
        # tipped on every other kick); otherwise his left hand has it by the front of
        # the brim and it goes where the hand does: behind his back (out of sight),
        # out and up to his head, off again and held high at the finish, and back
        # behind him. Its origin is the middle of its brim, y toward his back.
        HAT_BEHIND = [0.04, 0.26, 1.0, -90.0, 0.0, 0.0]
        HAT_UP = [0.52, 0.0, 1.82, -20.0, 0.0, -15.0]
        held_a = keyed([(4.0, HAT_BEHIND), (8.0, [0.36, 0.12, 1.12, -55.0, 0.0, 15.0]), (12.0, [0.30, -0.06, 1.94, -12.0, 0.0, 10.0]), (15.0, [0.02, -0.05, 2.0, 4.0, 0.0, 0.0])])
        held_b = keyed([
            (T_FIN - 8.0, [0.02, -0.05, 2.0, 4.0, 0.0, 0.0]),
            (T_FIN - 1.0, HAT_UP),
            (T_FIN_END, HAT_UP),
            (T_FIN_END + 3.0, [0.50, 0.20, 1.40, -60.0, 0.0, 0.0]),
            (T_FIN_END + 6.0, HAT_BEHIND),
        ])
        HAT_REST = np.array([0.0, -0.047, 1.724])  # (the middle of its brim on his head, in his head's own rest coordinates)

        def hat_worn_share(tau):
            return smoother((tau - 13.0) / 4.0) * (1.0 - smoother((tau - (T_FIN - 8.0)) / 6.0))

        def hat_visible(tau):
            return 4.0 <= tau <= T_FIN_END + 6.0

        def hat_hand_w(tau):
            """How much his left hand has the hat's brim (otherwise it is on the cane)."""
            return smoother((tau - 1.0) / 3.0) * (1.0 - smoother((tau - (T_FIN_END + 6.0)) / (T_END - T_FIN_END - 7.0)))

        def hat_tip(tau):
            """Every other kick he tips the brim (degrees, forward)."""
            return sum(9.0 * bump(tau, T_K0 + KP * i + 0.25 * KP, T_K0 + KP * i + 0.85 * KP) for i in range(1, NK, 2))

        def mat_lerp(A, B, e):
            U, _, Vt = np.linalg.svd((1 - e) * A + e * B)
            return U @ Vt

        def hat_pose(R, root, xy, psi, tau):
            """The hat's 4x4 (character space), or None before he has it."""
            if tau < 0.0 or tau > T_END or tau < 3.0:
                return None
            Yp = yaw(psi)
            D = self.fk(R, root)
            Mw = np.eye(4)
            Rw = rot(x=8.0 + hat_tip(tau), y=8.0)
            Mw[:3, :3] = Rw
            Mw[:3, 3] = HAT_REST
            worn = D[self.idx["head"]] @ Mw
            e = hat_worn_share(tau)
            if e >= 1.0:
                return worn
            hv = held_a(tau) if tau < 60.0 else held_b(tau)
            Rh = Yp @ rot(x=hv[3], y=hv[4], z=hv[5])
            ch = np.append(xy + Yp[:2, :2] @ hv[:2], hv[2])
            if e <= 0.0:
                M = np.eye(4)
                M[:3, :3], M[:3, 3] = Rh, ch
                return M
            M = np.eye(4)
            M[:3, :3] = mat_lerp(Rh, worn[:3, :3], e)
            M[:3, 3] = ch * (1 - e) + worn[:3, 3] * e
            return M

        def d_weight(tau):
            """How much of his body is the dance's."""
            return smoother(tau / 8.0) * (1.0 - smoother((tau - (T_END - 10.0)) / 9.0))

        # ── His cane: where its tip is set down, and where his hand would be.
        A_hand = 0.08
        side_tip = np.array([X0 + self.cane_x, Ye - 0.13, 0.0])
        # Facing you, the cane stands a forearm's length in front of him, so his
        # arms reach forward to it rather than folding into his chest.
        front_tip = np.array([X0 - 0.42, Ye, 0.0])
        side_knob = np.array([side_tip[0] + 0.025, Ye])

        def stride_tip(t0):
            return np.array([X0 + self.cane_x, hips_y(t0) + self.hand_y - d / 4, 0.0])

        canes = []  # (planted at, lifted at, tip)
        for k in range(-1, 4):
            t0 = tw + k * C
            canes.append((t0, t0 + C / 2, stride_tip(t0)))
        # He carries it at his side as he comes round (CARRY), and only facing
        # you brings it out in front and sets it down.
        carry0, carry1 = t_turn + 0.1 * nF, t_hands + 0.55 * nG
        # ...and turning away, carries it back round to his side the same way.
        back0, back1 = t_back + 0.1 * nJ, t_back + 0.65 * nJ
        canes.append((ts + C, carry0, side_tip))
        front_tip1 = front_tip + np.array([0.0, -DTR, 0.0])
        canes.append((carry1, D0 + 10.0, front_tip))
        canes.append((D0 + T_END - 12.0, back0, front_tip1))
        # (Where he has carried it to, as a moment's stop before his stride.)
        canes.append((back1, back1, None))
        for k in range(0, 3):
            t0 = t_s2 + k * C
            canes.append((t0, t0 + C / 2, stride_tip(t0)))

        P1_now = lambda t: P_end if t < D0 + 0.5 * T_END else P1

        def front_knob(psi, t=0.0):
            return P1_now(t) + yaw(psi)[:2, :2] @ np.array([0.0, -0.36])

        def stride_knob(t):
            return np.array([X0 + self.cane_x + 0.03, hips_y(t) + self.hand_y - A_hand * math.cos(2 * math.pi * phase(t))])

        def knob_xy(t, psi):
            """Where his hand wants the knob (x, y)."""
            if t < ts + C / 2:
                return stride_knob(t)
            if t < ts + C:
                return lerp(stride_knob(t), side_knob, ease((t - ts - C / 2) / (C / 2)))
            if t < t_turn:
                return side_knob
            if t < t_back:
                return lerp(side_knob, front_knob(psi, t), smoother(-psi / 90.0))
            if t <= back0:
                return front_knob(-90.0, t)
            if t < t_s2:
                # From his side, where he carried it, into his stride.
                at_side = landed[0][:2]
                return lerp(at_side, stride_knob(t_s2), smoother((t - back1) / (t_s2 - back1)))
            return stride_knob(t)

        # Carried, the cane is placed relative to him (x across, y back, from his
        # hips): at his right side, leaning a little forward, held clear of the
        # ground; then, facing you, swung out round in front of him on an arc
        # well clear of his body, and set down.
        side_body = (np.array([self.cane_x + 0.025, -0.03]), np.array([self.cane_x, -0.10]))
        front_body = (np.array([0.0, -0.36]), np.array([0.0, -0.42]))

        def arc(a, b, f):
            # Swung wide of him on the way (never across his front).
            ra, rb = math.hypot(*a), math.hypot(*b)
            ta, tb = math.atan2(a[0], -a[1]), math.atan2(b[0], -b[1])
            r = ra + (rb - ra) * f + 0.08 * math.sin(math.pi * f)
            th = ta + (tb - ta) * f
            return np.array([r * math.sin(th), -r * math.cos(th)])

        def carried(t, psi):
            if t < back0:
                f = smoother((t - t_hands) / (carry1 - t_hands)) if t > t_hands else 0.0
                lift = 0.03 * min(1.0, (t - carry0) / 4.0) * (1.0 - f)
            else:
                f = 1.0 - smoother((t - back0) / (back1 - back0))
                lift = 0.03 * math.sin(math.pi * min(1.0, (t - back0) / (back1 - back0)))
            knob_b = arc(side_body[0], front_body[0], f)
            tip_b = arc(side_body[1], front_body[1], f)
            Y = yaw(psi)[:2, :2]
            tip = np.append(P1_now(t) + Y @ tip_b, 0.0)
            top = self._knob(tip, P1_now(t) + Y @ knob_b)
            return tip + np.array([0.0, 0.0, lift]), top + np.array([0.0, 0.0, lift])

        def cane_at(t, psi):
            """(tip, top) of the cane: planted, or swinging under his hand to
            where it will be planted next (clear of the ground)."""
            if carry0 < t < carry1 or back0 < t <= back1:
                return carried(t, psi)
            xy = knob_xy(t, psi)
            for k, (t0, t1, tip) in enumerate(canes):
                if t0 <= t <= t1 or (k == 0 and t < t0):
                    return tip, self._knob(tip, xy)
                nxt = canes[k + 1] if k + 1 < len(canes) else None
                if nxt and t1 < t < nxt[0]:
                    u = (t - t1) / (nxt[0] - t1)
                    tip = lerp(tip, nxt[2], ease(u))
                    tip[2] = 0.0
                    top = self._knob(tip, xy)
                    # Lifted clear as it swings.
                    lift = 0.03 * math.sin(math.pi * u)
                    return tip + np.array([0.0, 0.0, lift]), top + np.array([0.0, 0.0, lift])
            tip = canes[-1][2]
            return tip, self._knob(tip, xy)

        # ── How he is turned, and where his weight is.
        def hips_at(t):
            p = phase(t)
            w = pace(t)
            ph = 2 * math.pi * p
            turn = 4.0 * math.cos(ph) * w
            drop = 3.0 * math.sin(2 * ph) * w
            sway = 0.008 * self.H * math.sin(ph) * w
            psi, shift = 0.0, np.zeros(2)
            if t_turn <= t < t_back:
                u = (t - t_turn) / nF
                psi = -90.0 * smoother(u)
                shift = 0.35 * (plants["L"][5].F - P_end) * bump(u, 0.0, 0.5) + 0.35 * (plants["R"][5].F - P_end) * bump(u, 0.45, 0.95)
            elif t >= t_back:
                u = (t - t_back) / nJ
                psi = -90.0 + 90.0 * smoother(u)
                shift = 0.35 * (plants["L"][6].F - P_end) * bump(u, 0.05, 0.6)
            if D0 <= t <= D0 + T_END:
                tau = t - D0
                return pelvis(tau) + np.array([d_lat(tau), 0.0]), psi + d_yaw(tau), rot(x=-d_tilt(tau), y=d_hike(tau))
            return np.array([X0 + sway + shift[0], hips_y(t) + shift[1]]), psi, rot(y=drop * 0.6, z=turn)

        # Where he set the cane down at his side, turning away (its top, its tip).
        landed = [None]
        top_b1 = None
        for i, (t0, t1, tip) in enumerate(canes):
            if tip is None:
                tip_b1, top_b1 = carried(t0, hips_at(t0)[1])
                canes[i] = (t0, t1, tip_b1)
        landed[0] = top_b1

        def root_of(xy, psi, Rloc, z):
            M = np.eye(4)
            M[:3, :3] = yaw(psi) @ Rloc
            M[:3, 3] = np.array([xy[0], xy[1], z]) - M[:3, :3] @ self.Jp
            return M

        frames = [max(float(f), tw) for f in range(0, int(math.ceil(t_end)))]
        # Where the dance falls in the scene's frame numbers (for take.json).
        self.dance_frames = (int(round(t_dance - ts)), int(round(t_release - ts)))

        # ── How high his hips ride: as high as his planted legs reach, the leg
        # he stands on all but straight (a walk rises over each step and dips
        # a little as the weight passes from one foot to the other).
        def reach_height(t):
            xy, psi, Rloc = hips_at(t)
            root = root_of(xy, psi, Rloc, 0.0)
            still = 1.0 - pace(t)
            zs = []
            for s in "LR":
                A, _, _, down = foot_state(s, t)
                leg = self.legs[s]
                hip = (root @ np.append(leg["hip"], 1.0))[:3]
                reach = (0.998 + 0.0015 * still) * (leg["a"] + leg["b"])
                r = math.hypot(A[0] - hip[0], A[1] - hip[1])
                if down or A[2] < leg["A0"][2] + self.sole + 0.02:
                    zs.append(A[2] + math.sqrt(max(0.0, reach * reach - r * r)) - hip[2])
            if not zs:
                raise RuntimeError(f'no foot on the ground at tau={t - D0}')
            k = 0.012
            m = min(zs)
            return m - k * math.log(sum(math.exp(-(z - m) / k) for z in zs)), max(zs)

        both = np.array([reach_height(t) for t in frames])
        # Walking, his hips fall less far into each change of feet (from
        # what the one leg allows toward what both do): a man walking does not
        # squat between steps. At that instant the leading heel comes down a
        # moment later instead, and the trailing toe leaves a moment sooner.
        pace_f = np.array([pace(t) for t in frames])
        raw = both[:, 0] + 0.35 * (both[:, 1] - both[:, 0]) * pace_f
        # (Smoothed only a little, and only where it must be: the dip as the
        # weight changes feet lasts a few frames, and must not drag the rest
        # of the stride down with it.)
        kern = np.exp(-0.5 * (np.arange(-2, 3) / 0.9) ** 2)
        kern /= kern.sum()

        def smooth(x):
            return np.convolve(np.concatenate([np.full(2, x[0]), x, np.full(2, x[-1])]), kern, mode="valid")

        z = smooth(raw)
        over = np.maximum(0.0, z - raw)
        over = smooth(np.array([over[max(0, i - 2) : i + 3].max() for i in range(len(over))]))
        z_hips = np.minimum(z - over, raw) - np.array([d_sink(f - D0) for f in frames])
        self.z_hips = z_hips

        # ── The upper body.
        HEAD = (("spine04", 4.0), ("spine02", 6.0), ("neck01", 22.0), ("head", 36.0))
        EYES = 22.0

        def breath(t):
            return 0.5 - 0.5 * math.cos(2 * math.pi * max(0.0, t - te) / 52.0) if te < t < t_s2 else 0.0

        def upper(t):
            p = phase(t)
            w = pace(t)
            ph = 2 * math.pi * p
            turn = 4.0 * math.cos(ph)
            drop = 3.0 * math.sin(2 * ph)
            b = breath(t)
            Rw = {
                # Tall: chest up, shoulders back, the head carried over them.
                "spine04": rot(z=-turn * 0.5),
                "spine02": rot(x=-0.5, y=-drop * 0.4, z=-turn * 0.9),
                "neck01": rot(x=-4.0, z=turn * 0.3),
                "head": rot(x=3.5, z=turn * 0.2),
                "clavicle.L": rot(z=4.0),
                "clavicle.R": rot(z=-4.0),
            }
            opp = wm._curve("hip", (p + 0.5) % 1.0) * wm.STRIDE
            Rw["upperarm01.L"] = rot(x=-0.75 * opp + 1.0, y=5.0)
            Rw["lowerarm01.L"] = rot(x=-(12.0 + 0.6 * max(0.0, opp)))
            Rs = {
                "spine04": rot(x=-0.8 * b),
                "spine02": rot(x=-0.5 - 1.4 * b),
                "neck01": rot(x=-4.0),
                "head": rot(x=4.0),
                "clavicle.L": rot(y=-1.2 * b, z=4.0),
                "clavicle.R": rot(y=1.2 * b, z=-4.0),
                "upperarm01.L": rot(y=1.0 + 0.6 * b, x=-2.0),
                "lowerarm01.L": rot(x=-12.0),
            }
            R, _ = wc._blend((Rs, np.eye(4)), (Rw, np.eye(4)), w)
            return R

        def on_knob(t):
            """0: his fist round the cane under the knob; 1: his palm on the
            knob (his hands at rest on it, facing you)."""
            return smoother((t - t_hands - 0.3 * nG) / (0.4 * nG)) * (1.0 - smoother((t - t_release) / nI))

        def look(R, amount, eyes, pitch):
            for bone, deg in HEAD:
                _after(R, bone, rot(z=-deg * amount))
            for s in "LR":
                R[f"eye.{s}"] = rot(x=pitch, z=-EYES * eyes)

        def gaze(t):
            """(head, eyes, pitch): how far his head and eyes are turned to you
            (1: on you, over his shoulder), and how far his eyes look up."""
            if t < t_eyes:
                return 0.0, 0.0, 0.0
            if t < t_turn:
                u = (t - t_eyes) / 20.0
                return smoother((u - 0.15) / 0.85), ease(u / 0.3), -TILT * 0.5 * ease(u)
            if t < t_hands:
                u = smoother((t - t_turn) / nF)
                return 1.0 - u, 1.0 - u, -TILT * (0.5 + 0.5 * u)
            up = -TILT - 4.0 * smoother((t - t_hands) / nG)
            if t < t_back:
                return 0.0, 0.0, up
            # Turning away, his eyes stay on you until he has come round; then
            # he looks where he is going.
            u = (t - t_back) / nJ
            hold = smoother(u) * (1.0 - smoother((u - 0.6) / 0.6))
            return hold, hold, up * (1.0 - smoother((u - 0.5) / 0.6))

        def dance_upper(R, tau):
            """What the dance does to his body above the hips (on top of his stance)."""
            ln = d_ln(tau)
            # He leans back as a counterbalance in proportion to the kick, a frame or two behind the leg.
            kb = kick_lift(tau - 1.0) * ln
            kh = kick_lift(tau - 2.0) * ln
            _after(R, "spine02", rot(x=-5.0 * ln - 9.0 * kb))
            _after(R, "spine04", rot(x=-5.0 * ln - 7.0 * kb))
            _after(R, "neck01", rot(x=-2.0 * ln - 2.0 * kh))
            _after(R, "head", rot(x=-3.0 * ln - 3.0 * kh))
            # The cue: a small, sly nod, the eyes staying on you.
            nod = keyed([(0.0, 0.0), (1.0, -0.2), (3.0, 1.0), (6.0, 0.2), (9.0, 0.0)])
            nn, nh = float(nod(tau - 1.0)), float(nod(tau - 2.0))
            _after(R, "neck01", rot(x=9.0 * nn))
            _after(R, "head", rot(x=8.0 * nh))
            for s in "LR":
                R[f"eye.{s}"] = R[f"eye.{s}"] @ rot(x=-14.0 * nh)
            # In profile his head turns to you over his shoulder, his eyes on you.
            prof = d_psi(tau) / 90.0
            if prof > 0.0:
                for bone, deg in HEAD:
                    _after(R, bone, rot(z=-deg * 0.8 * prof))
                for s in "LR":
                    R[f"eye.{s}"] = R[f"eye.{s}"] @ rot(z=-EYES * 0.6 * prof)
            # The finish: head cocked, chest up, shoulders flung back.
            fin = smoother((tau - (T_FIN - 4.0)) / 5.0) * (1.0 - smoother((tau - (T_FIN_END - 1.0)) / 8.0))
            _after(R, "head", rot(x=-4.0 * fin, y=-9.0 * fin))
            _after(R, "spine02", rot(x=-5.0 * fin))
            _after(R, "clavicle.L", rot(y=-4.0 * fin))
            _after(R, "clavicle.R", rot(y=4.0 * fin))

        out = []
        k_scene = 0
        left_from = None
        left_back = None
        for fi, t in enumerate(frames):
            xy, psi, Rloc = hips_at(t)
            root = root_of(xy, psi, Rloc, float(z_hips[fi]))
            R = upper(t)
            a, e, pitch = gaze(t)
            if t >= t_eyes:
                look(R, a, e, pitch)
            tau = t - D0
            dwt = d_weight(tau)
            if t_hands <= t < t_back + nJ:
                u = smoother((t - t_hands) / nG) * (1.0 - smoother((t - t_release) / (nI + nJ * 0.5))) * (1.0 - dwt)
                # He leans a little onto it, his shoulders coming forward as his
                # hands go to the knob, so his arms fall in front of him.
                _after(R, "spine02", rot(x=3.5 * u))
                _after(R, "clavicle.L", rot(z=-8.0 * u))
                _after(R, "clavicle.R", rot(z=8.0 * u))
                tilt = smoother((t - t_regard) / nH) * (1.0 - smoother((t - t_release) / nI)) * (1.0 - dwt)
                _after(R, "head", rot(x=1.5 * u, y=-3.5 * tilt))
            if 0.0 <= tau <= T_END:
                dance_upper(R, tau)
            # The legs.
            fwd = yaw(psi) @ np.array([0.0, -1.0, 0.0])
            for s, out_x in (("L", 1.0), ("R", -1.0)):
                A, G, toe, _ = foot_state(s, t)
                self.step(R, root, s, A, G, toe, fwd + yaw(psi) @ np.array([0.12 * out_x, 0.0, 0.0]))
            hatM = hat_pose(R, root, xy, psi, tau)
            # His free hand hangs at ease.
            self.relax_hand(R, root, "L", 0.42)
            # The cane, and his right hand on it: carried in his fist, or (facing
            # you) his palm resting on the knob.
            tip, top = cane_at(t, psi)
            u_cane = unit(top - tip)
            k = on_knob(t)
            fwd_f = yaw(psi) @ np.array([0.0, -1.0, 0.0])
            inward = yaw(psi) @ np.array([1.0, 0.0, 0.0])
            f_grip = unit(fwd_f - (fwd_f @ u_cane) * u_cane)
            n_grip = unit(inward - (inward @ u_cane) * u_cane - (inward @ f_grip) * f_grip)
            grip = top - u_cane * 0.055 - n_grip * 0.02 - f_grip * 0.025
            on = top + u_cane * 0.02
            f_body = lerp((-0.35, -1.0, -0.15), (0.25, -1.0, -0.2), smoother(-psi / 90.0))
            # (Carrying it, his elbow points back; resting on it, out to the side.)
            pole_r = lerp((-0.5, 1.0, -0.1), (-0.85, 0.5, -0.15), k)
            target_r, fing_r, palm_r, pole_w = lerp(grip, on, k), lerp(f_grip, yaw(psi) @ f_body, k), lerp(n_grip, -u_cane, k), yaw(psi) @ pole_r
            curl_r = 0.9 - 0.3 * k
            wcn = wc_cane(tau) if 0.0 <= tau <= T_END else 0.0
            if wcn > 0.0:
                # The dance's cane (on his stage), his fist round it where it is.
                Gd, ud, sgd, uhd, hk = cane_dance(tau)
                Yp = yaw(psi)
                Gw = np.append(xy + Yp[:2, :2] @ Gd[:2], Gd[2])
                uw, uhw = Yp @ ud, Yp @ uhd
                top = lerp(top, Gw + uw * (0.055 + sgd), wcn)
                u_cane = unit(lerp(u_cane, uw, wcn))
                tip = top - u_cane * self.L
                if tip[2] < 0.0:
                    top = top - np.array([0.0, 0.0, tip[2]])
                    tip[2] = 0.0
                fv, iv = Yp @ np.array([0.0, -1.0, 0.0]), Yp @ np.array([1.0, 0.0, 0.0])
                f_d = unit(fv - (fv @ uhw) * uhw)
                n_d = unit(iv - (iv @ uhw) * uhw - (iv @ f_d) * f_d)
                if hk > 0.0:
                    f_d, n_d = unit(lerp(f_d, Yp @ F_KC, hk)), unit(lerp(n_d, Yp @ N_KC, hk))
                target_r = lerp(target_r, Gw - n_d * 0.02 - f_d * 0.025, wcn)
                fing_r, palm_r = lerp(fing_r, f_d, wcn), lerp(palm_r, n_d, wcn)
                pole_w = lerp(pole_w, Yp @ np.array([-1.0, 0.3, -0.25]), min(1.0, 3.0 * wcn))
                curl_r = curl_r + (0.85 - curl_r) * wcn
            self.reach(R, root, "R", target_r, fing_r, palm_r, pole_w)
            # A fist round the shaft; resting on the knob, fingers closed over it.
            self.fingers(R, "R", curl_r)
            # His left hand comes to rest on his right, and leaves it again.
            if t_hands <= t < t_back:
                if left_from is None:
                    left_from = (self.palm_of(R, root, "L"), *self.hand_dirs(R, root, "L"))
                right = self.palm_of(R, root, "R")
                on = right + yaw(psi) @ np.array([-0.004, -0.012, 0.0]) + np.array([0.0, 0.0, 0.042])
                on_dirs = (yaw(psi) @ np.array([-0.55, -1.0, -0.1]), np.array([0.0, 0.0, -1.0]))
                if t < t_release:
                    # (Once the cane is down and his right hand is on it.)
                    u = (t - t_hands - 0.45 * nG) / (0.55 * nG)
                    e = smoother(u)
                    start = left_from
                    lift = bump(u)
                else:
                    if left_back is None:
                        R0 = upper(t_back)
                        self.relax_hand(R0, root, "L", 0.42)
                        left_back = (self.palm_of(R0, root, "L"), *self.hand_dirs(R0, root, "L"))
                    u = (t - t_release) / nI
                    e = 1.0 - smoother(u)
                    start = left_back
                    lift = bump(u)
                target = lerp(start[0], on, e) + np.array([0.0, 0.0, 0.035]) * lift
                fing_l, palm_l, pole_l = lerp(start[1], on_dirs[0], e), lerp(start[2], on_dirs[1], e), yaw(psi) @ np.array([0.85, 0.5, -0.15])
                wh = hat_hand_w(tau) if 0.0 <= tau <= T_END else 0.0
                Yp = yaw(psi)
                if wh > 0.0 and hatM is not None:
                    # His fingers on the front of the brim, his palm over it.
                    pg = (hatM @ np.array([0.0, -0.150, 0.012, 1.0]))[:3]
                    fg = hatM[:3, :3] @ unit([0.0, 1.0, 0.1])
                    ng = hatM[:3, :3] @ np.array([0.0, 0.0, -1.0])
                    swing = 4.0 * wh * (1.0 - wh)
                    target = lerp(target, pg, wh) + Yp @ (np.array([0.30, 0.0, -0.05]) * swing)
                    fing_l, palm_l = unit(lerp(fing_l, fg, wh)), unit(lerp(palm_l, ng, wh))
                    pole_l = lerp(pole_l, Yp @ np.array([0.9, 0.2, 0.8]), min(1.0, 2.0 * wh))
                self.reach(R, root, "L", target, fing_l, palm_l, pole_l)
                # Resting on his right hand, the fingers lie together over it.
                self.fingers(R, "L", 0.42 + 0.2 * e + 0.1 * wh)
            rec = None
            if fi < tw:
                pass
            elif ts - C <= t < ts:
                rec = ("walk", int(round(t - (ts - C))))
            elif t >= ts:
                rec = ("scene", k_scene)
                k_scene += 1
            blink = {20: 0.35, 21: 0.8, 22: 1.0, 23: 1.0, 24: 0.75, 25: 0.35}.get(int(round(t - t_regard)), 0.0)
            M = np.eye(4)
            zc = unit(top - tip)
            xc = unit(np.cross([0.0, 1.0, 0.0], zc))
            M[:3, 0], M[:3, 1], M[:3, 2], M[:3, 3] = xc, np.cross(zc, xc), zc, tip
            out.append(dict(R=R, root=root, cane=M, blink=blink, hat=(hatM if (hatM is not None and hat_visible(tau)) else None), hips=float(xy[1]) if D0 <= t <= D0 + T_END else float(hips_y(t)), rec=rec))
        return out

    def arm_clearance(self, take):
        """How far his elbows and forearms stay outside his body, at the
        closest, over every rendered frame (m; negative: an arm inside him).
        His torso is its outline at each height in the rest pose, let out by
        his jacket; each elbow and forearm is brought back into his own frame
        (hips at the origin, facing -y) and measured against the outline at
        its height."""
        base = mh.Base.get()
        body = base.verts_of("body")
        names = self.sk.names
        cols = [self.idx[n] for n in names if n.startswith(("upperarm", "lowerarm", "wrist", "finger", "metacarpal", "shoulder", "clavicle", "neck", "head", "upperleg", "lowerleg", "foot", "toe"))]
        limbs = self.W[body][:, cols].sum(1)
        torso = self.co[body][limbs < 0.2] - self.Jp
        zs = np.arange(-0.1, 0.45, 0.02)
        th = np.linspace(0, 2 * math.pi, 48, endpoint=False)
        outline = {}
        for z in zs:
            band = torso[np.abs(torso[:, 2] - z) < 0.015]
            if len(band) < 8:
                continue
            ang = np.arctan2(band[:, 0], -band[:, 1]) % (2 * math.pi)
            r = np.hypot(band[:, 0], band[:, 1])
            k = (np.round(ang / (2 * math.pi) * 48).astype(int)) % 48
            radius = np.zeros(48)
            np.maximum.at(radius, k, r)
            for _ in range(48):
                gap = radius == 0
                if not gap.any():
                    break
                radius[gap] = np.maximum(np.roll(radius, 1), np.roll(radius, -1))[gap]
            outline[round(float(z), 2)] = radius + 0.012
        worst = float("inf")
        self.by_frame = {}
        for f in take:
            if f["rec"] is None:
                continue
            D = self.fk(f["R"], f["root"])
            inv = np.linalg.inv(f["root"])
            for s in "LR":
                E = self.at(D, f"lowerarm01.{s}", self.heads[self.idx[f"lowerarm01.{s}"]])
                W = self.at(D, f"wrist.{s}", self.heads[self.idx[f"wrist.{s}"]])
                for P in (E, (E + W) / 2, W):
                    q = (inv @ np.append(P, 1.0))[:3] - self.Jp
                    z = round(round(q[2] / 0.02) * 0.02, 2)
                    if z not in outline:
                        continue
                    a = math.atan2(q[0], -q[1]) % (2 * math.pi)
                    edge = outline[z][int(round(a / (2 * math.pi) * 48)) % 48]
                    c = math.hypot(q[0], q[1]) - edge
                    if c < worst:
                        worst, self.worst_at = c, (f["rec"], s)
                    self.by_frame[f["rec"]] = min(self.by_frame.get(f["rec"], 9.0), c)
        return worst

    def _knob(self, tip, xy):
        """The top of the cane over `tip`, toward (x, y), on the sphere of its length."""
        dx, dy = xy[0] - tip[0], xy[1] - tip[1]
        return np.array([xy[0], xy[1], tip[2] + math.sqrt(max(1e-6, self.L**2 - dx * dx - dy * dy))])
