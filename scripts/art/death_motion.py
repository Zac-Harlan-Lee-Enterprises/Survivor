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
  a vaudeville high-kick line, DANCE frames (9.7 s), in which he travels about
  two and a half metres toward the walk-off; the scene after it starts from
  where it leaves him. Planned in the world, so every foot is a real plant and
  the pelvis carries the travel (`take.json` / `deathFrames.json` record it
  frame by frame, as for a walk). A grown man in a suit, not a contortionist:
  every joint stays inside a human range on every frame (`joint_check`, which
  fails the render: knees bend only toward the toes, hips no further than a
  dancer's straight leg goes, the spine no more than twenty degrees back,
  wrists, elbows and neck inside their ranges, no foot through the floor or
  dragged along it), each measured in the limb's own frame (the pelvis's
  sideways axis), never against a world axis. *The cue*: one small, sly nod, his
  eyes staying on you. *The hat*: as he nods his left hand goes behind his
  back and brings out a straw boater (death_dress.boater; one rigid object,
  hidden behind him until it is in hand), swings it out and up and sets it on
  his head, a little forward and to one side, while the cane is twirled once
  about his right hand. *The turn*: he turns toward the line of kicks, his
  chest cheated out to the house (PSK: fifty degrees round from facing along
  his way), so the kicks read in silhouette and his face, his hat and the hand
  on its brim are in view. *The line* builds, kick by kick (KICKS): two at the
  waist, four climbing to chest height with the brim tipped on the beat, four
  quicker ones (seven frames each) and a last, highest one, held. A kick is a
  whip, not a pendulum: the thigh leads with the knee bent as the foot leaves
  the floor (lifted before it travels, and set straight down), the knee
  straightens through the middle of the swing and the leg is straight only at
  the top, toe pointed, hanging; down is faster than up, the knee softens, and
  the foot lands on its ball and then its heel. The knee always goes to the
  front of the leg whichever way it is swung (the direction hip to ankle turned
  about the pelvis's sideways axis). The pelvis tucks under and hikes on the
  kicking side as the leg rises; he leans back a little (never more than
  eleven degrees), more with the higher kicks, and the head, the cane and the
  arms follow a frame or two behind the legs; his shoulders pop on every beat.
  The other leg works: the knee bends to load before each kick, straightens as
  it goes up, the heel rises onto the ball at the top, it bends to take the
  landing, and his weight goes over it before the kick leaves. One step per
  kick carries him on a step. The cane lives with the kicks; his left hand
  holds the front of the hat's brim, the elbow up and out so the forearm stays
  off his face. *The turn out*: he pivots on the balls of both feet to face
  you, eased. *The bow*: the hat comes off, swept across his body in his left
  hand as he hinges from the hips. *The ta-da*: he pops up, the hat high in
  his left hand, the cane high in his right, arms wide, weight on his left leg,
  the right heel lifted, head cocked, his mouth open, held a beat and a half
  with a breath. Then he settles: the hat goes round behind his back and is
  gone (he walks off hatless, as he came), the cane comes back and is set
  down in front of him (where he now stands), his hands go back on it, and the
  scene goes on as before. Every pose is eased in and out (the cane's turns
  are slerped, never lerped through nothing). (Motion blur is off: the code to
  average sub-frame poses is in death_scene.py and death_blur.py, off by
  default, as it showed a fan of ghost limbs at this frame rate.)
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
DANCE = 194
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


def slerp_dir(a, b, e):
    """The direction e of the way from a to b round the shorter arc (when they are
    nearly opposite, round the way that swings a forward: a straight lerp would pass
    through nothing and whip the other way in a frame or two)."""
    a, b = unit(a), unit(b)
    ang = math.acos(float(np.clip(a @ b, -1.0, 1.0)))
    if ang < 1e-4:
        return a
    if ang > math.pi - 0.05:
        ax = np.array([1.0, 0.0, 0.0])
        ax = unit(ax - (ax @ a) * a)
    else:
        ax = unit(np.cross(a, b))
    th = ang * e
    return a * math.cos(th) + np.cross(ax, a) * math.sin(th)


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

    def reach2(self, R, root, s, palm_at, fingers, palm, pole, follow=0.6):
        """`reach`, then the hand turned part of the way along the forearm that resulted (a wrist is
        not bent square), and reach again."""
        self.reach(R, root, s, palm_at, fingers, palm, pole)
        D = self.fk(R, root)
        E = self.at(D, f"lowerarm01.{s}", self.heads[self.idx[f"lowerarm01.{s}"]])
        Wr = self.at(D, f"wrist.{s}", self.heads[self.idx[f"wrist.{s}"]])
        fore = unit(Wr - E)
        # (and the palm turned so the hand can lie along the forearm: a palm facing straight down the arm cannot)
        palm2 = unit(unit(palm) - 0.85 * follow * float(unit(palm) @ fore) * fore)
        return self.reach(R, root, s, palm_at, unit((1 - follow) * unit(fingers) + follow * fore), palm2, pole)

    def step(self, R, root, s, ankle, G, toe, knee, own=None):
        """Put foot `s`'s ankle at `ankle`, the foot turned G (rest -> posed),
        its toes bent `toe` degrees (to stay on the ground as the heel rises),
        the knee toward `knee`."""
        leg = self.legs[s]
        D = self.fk(R, root)
        S = self.at(D, f"upperleg01.{s}", leg["hip"])
        if own is not None:
            # (Dancing: the knee goes to the front of the leg whichever way it is swung: the
            # direction hip -> ankle turned about the pelvis's own sideways axis, a touch toed out.)
            lat = unit(root[:3, 0])
            dh = unit(np.asarray(ankle, float) - S)
            knee = np.cross(dh, lat) + 0.15 * own * lat
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
                    wxy, wz = w_of(t)
                    K_ = arc(t)
                    A = np.array([A[0] * (1 - wxy) + K_[0] * wxy, A[1] * (1 - wxy) + K_[1] * wxy, A[2] * (1 - wz) + K_[2] * wz])
                    th = th + (k_pitch(t) - th) * wz
                    G_ = yaw(turn) @ rot(x=th)
                    lg = self.legs[s]
                    low = A[2] + min(float((G_ @ lg["hv"])[2]), float((G_ @ lg["bv"])[2]))
                    if low < self.sole:
                        A[2] += self.sole - low
                return A, yaw(turn) @ rot(x=th), (max(th, 0.0) if (pl.air or prev.air) else 0.0), False
            if t <= pl.t3:
                th = pl.pitch(t)
                A, G = self.foot_pose(s, pl.F, pl.turn, th)
                return A, G, max(th, 0.0), True
        pl = plants[-1]
        A, G = self.foot_pose(s, pl.F, pl.turn, 0.0)
        return A, G, 0.0, True

    # ── the take ──────────────────────────────────────────────────────────
    def take(self, shift=0.0):
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
        # tau is the frame within it; the beat is BEAT frames. He nods and brings
        # out a boater, twirls the cane, turns toward you (but not full on: his
        # chest cheated out to the house) and kicks his way across the floor,
        # warming up, climbing to head height, a flurry in double time and one
        # last held kick; turns out to face you, bows with the hat swept across
        # him, pops up into the ta-da and settles on the cane.
        D0 = float(t_dance)
        LEG = {s: legs[s]["a"] + legs[s]["b"] for s in "LR"}
        FV = np.array([0.0, -1.0])  # the way he travels (world x y): toward the walk-off
        T_NOD, T_LIFT0, T_TW0, T_TW1 = 3.0, 5.0, 8.0, 18.0
        T_T0 = 20.0  # he starts to turn toward the line
        PSK = -40.0  # how he stands for the kick line (-90 facing you, 0 along his way): 50 degrees round to the house
        YK = yaw(PSK)[:2, :2]
        FB = YK @ np.array([0.0, -1.0])  # where he faces then (his kicks go that way)
        K0, S0 = "L", "R"  # the foot that kicks first, and the one he stands on
        # The line, kick by kick: (frames, how high (degrees from hanging), how long it hangs at the top
        # (share of the kick), tips the brim). Two waist-high warm-ups, four climbing to head
        # height, four quick lower ones in double time, and the last, highest and held.
        KICKS = [(10, 88, 0.14, 0), (10, 94, 0.14, 0), (10, 100, 0.14, 1), (10, 106, 0.14, 1), (10, 110, 0.16, 1), (10, 114, 0.18, 1), (7, 92, 0.0, 0), (7, 92, 0.0, 0), (7, 96, 0.0, 0), (7, 96, 0.0, 0), (14, 116, 0.3, 0)]
        NK = len(KICKS)
        T_K0 = 30.0  # the first kick
        KS = [T_K0 + sum(k[0] for k in KICKS[:i]) for i in range(NK + 1)]  # where each kick starts (and the last ends)
        T_K1 = KS[-1]  # the last foot comes down
        T_B1 = T_K1 + 14.0  # he has turned out to face you
        T_BOW = T_B1 + 16.0  # the bow ends, he pops up
        T_FIN, T_FIN_END = T_BOW + 1.0, T_BOW + 16.0  # the ta-da, held 1.5 beats
        T_END = float(DANCE)
        STEP = 0.27  # how far each ten-frame kick carries him (m)
        V = STEP / 10.0
        SB = 0.55  # (a kicker's feet are set nearer the line he travels along)
        KICK_K = ["L" if (K0 == "L") == (i % 2 == 0) else "R" for i in range(NK)]
        P_AFTER = 10.0  # (the step after the last kick)

        def kperiod(i):
            return float(KICKS[i][0]) if i < NK else P_AFTER

        def sp(s):
            return YK @ np.array([SB * stand[s][0], stand[s][1]])

        def tp(s, dx=0.0, dy=0.0):
            """Where foot s's ankle is set down, from where it stands at rest."""
            return P_end + Rq @ (stand[s] + np.array([dx, dy]))

        def bvv(s):
            return self.legs[s]["bv"][:2]

        def pl3(F, a, b, c, d, turn=PSK, **kw):
            kw.setdefault("lift", 0.05)
            return Plant(F, turn, D0 + a, D0 + b, D0 + c, D0 + d, air=True, **kw)

        # Where he is turned: -90 facing you; PSK for the line.
        def d_turn_in(tau):
            return smoother((tau - (T_T0 + 1.0)) / (T_K0 - T_T0 - 2.0))

        def d_turn_out(tau):
            return smoother((tau - (T_K1 + 1.0)) / (T_B1 - T_K1 - 2.0))

        def d_psi(tau):
            return (PSK + 90.0) * d_turn_in(tau) * (1.0 - d_turn_out(tau))

        # The foot he kicks first turns on its ball; the other is stepped on ahead of where he stands.
        B0 = {s: tp(s) + Rq @ bvv(s) for s in "LR"}
        F_PROF = {s: B0[s] - YK @ bvv(s) for s in "LR"}
        P0 = float(KICKS[0][0])
        mid0 = np.array([P_end[0], P_end[1] - V * P0 * 0.5])
        y_start = mid0[1] + V * P0 * 0.5
        F_S0 = mid0 + sp(S0)

        def pel_lin(tau, xb):
            """His pelvis along the kick line: steady travel, a lateral drift to xb."""
            e = (tau - (T_K0 + P0 * 0.5)) / (T_K1 - T_K0)
            return np.array([mid0[0] + (xb - mid0[0]) * e, y_start - V * (tau - T_K0)])

        def land_F(i, xb):
            """Where kick i's foot comes down: where the pelvis will be over it, in the middle of the next kick."""
            return pel_lin(KS[i + 1] + 0.5 * kperiod(i + 1), xb) + sp(KICK_K[i])

        def fin_feet(xb):
            """Where his feet end the line, and the post-turn pelvis P1."""
            Fp = {KICK_K[-1]: land_F(NK - 1, xb), KICK_K[-2]: land_F(NK - 2, xb)}
            Fq = {s: Fp[s] + YK @ bvv(s) - Rq @ bvv(s) for s in "LR"}
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
            k = keyed([(T_K1, pel_lin(T_K1, xb)), (T_B1 + 3.0, P1), (T_END, P1)])
            return k(tau)

        def d_ln(tau):
            """How far he leans back through the kick line (0 to 1)."""
            return smoother((tau - (T_K0 - 6.0)) / 6.0) * (1.0 - smoother((tau - (T_K1 - 1.0)) / 7.0))

        # One kick (u, 0 to 1 over its frames): the thigh leads with the knee bent, the knee
        # straightens through the middle of the swing, the leg is straight only at the top;
        # a hang; then down faster, the knee softening, and the foot lands on its ball, the
        # heel following.
        def kick_curves(beta, hang):
            r = beta / 148.0
            pe = 0.46 + hang
            d = lambda f: pe + f * (0.97 - pe)
            alpha = keyed([(0.0, 6.0), (0.1, 24.0 * r), (0.25, 82.0 * r), (0.38, max(10.0, beta - 10.0 * r)), (0.46, beta), (pe, beta), (d(0.27), 100.0 * r), (d(0.62), 42.0 * r), (0.97, 10.0)])
            knee = keyed([(0.0, 6.0), (0.1, 36.0), (0.25, 38.0), (0.38, 12.0), (0.46, 0.0), (pe, 0.0), (d(0.27), 20.0), (d(0.62), 30.0), (0.97, 16.0)])
            toe = keyed([(0.0, 22.0), (0.1, 26.0), (0.25, 2.0), (0.4, -34.0), (0.46, -50.0 * r), (pe, -50.0 * r), (d(0.27), -12.0), (d(0.62), 12.0), (0.97, 24.0)])
            warc = keyed([(0.0, 0.0), (0.1, 1.0), (d(0.62), 1.0), (0.97, 0.0)])
            return alpha, knee, toe, warc

        KC = [kick_curves(k[1], k[2]) for k in KICKS]

        def kick_at(tau):
            """(i, u) for the kick in progress, or None."""
            if tau < T_K0 or tau >= T_K1:
                return None
            for i in range(NK):
                if KS[i] <= tau < KS[i + 1]:
                    return i, (tau - KS[i]) / kperiod(i)
            return None

        def kick_lift(tau):
            """How high the kick in progress is (0 to 1; 0 between kicks)."""
            h = kick_at(tau)
            if h is None:
                return 0.0
            return float(KC[h[0]][0](h[1])) / 148.0

        def kick_side(tau):
            """+1 while the right foot kicks, -1 for the left."""
            h = kick_at(tau)
            return 0.0 if h is None else (1.0 if KICK_K[h[0]] == "R" else -1.0)

        def accent(tau):
            """A little pop on every beat of the kick line."""
            if tau < T_K0 - 2 or tau > T_K1 + 2:
                return 0.0
            b = round((tau - T_NOD) / BEAT) * BEAT + T_NOD
            return math.exp(-(((tau - b) / 1.2) ** 2))

        def bow_amt(tau):
            """How far he is bowed (0 to 1)."""
            return smoother((tau - (T_B1 + 1.0)) / 6.0) * (1.0 - smoother((tau - (T_BOW - 7.0)) / 7.0))

        def d_sink(tau):
            """How far his knees give (m): the standing knee bends to load before
            each kick, straightens as the leg goes up, and bends again to take the landing."""
            if tau < 0.0 or tau > T_END:
                return 0.0
            z = 0.0
            ramp = smoother((tau - (T_K0 - 4.0)) / 4.0) * (1.0 - smoother((tau - (T_K1 + 2.0)) / 4.0))
            if ramp > 0.0:
                h = kick_at(tau)
                amp = 0.07 * (kperiod(h[0]) / 10.0) ** 0.5 if h is not None else 0.05
                z += ramp * amp * (1.0 - min(1.0, max(0.0, kick_lift(tau)))) ** 1.3
                z += ramp * 0.008 * accent(tau)
            z += 0.02 * smoother((tau - T_BOW) / 3.0) * (1.0 - smoother((tau - T_FIN_END) / 5.0))
            return z

        def d_tilt(tau):
            """How far his pelvis tucks under (degrees; negative: it hinges forward, in the bow)."""
            return 2.0 * d_ln(tau) + 4.0 * kick_lift(tau) * d_ln(tau) - 28.0 * bow_amt(tau)

        def d_hike(tau):
            """His pelvis hikes on the kicking side (roll, degrees)."""
            return 4.0 * kick_lift(tau) * kick_side(tau) * d_ln(tau)

        def d_lat(tau):
            """His weight goes over the standing foot before the kick leaves (m, across him)."""
            z = 0.0
            for i in range(NK):
                z += (0.045 if KICK_K[i] == "R" else -0.045) * bump(tau, KS[i] - (3.0 if i else 0.0), KS[i + 1] - 1.0)
            return z

        # His feet. Turned toward the line on the balls of the feet.
        def pivot(s, tau, B, a0, a1, ta, tb):
            frac = smoother((tau - ta) / (tb - ta))
            turn = a0 + (a1 - a0) * frac
            F = B - yaw(turn)[:2, :2] @ bvv(s)
            pitch = 14.0 * bump(tau, ta - 1.5, tb + 1.0)
            A, G = self.foot_pose(s, F, turn, pitch)
            return A, G, max(pitch, 0.0), True

        def heel_up(t):
            """The standing heel comes up onto the ball as the other leg reaches its height."""
            return 22.0 * max(0.0, min(1.0, (kick_lift(t - D0) - 0.35) / 0.55))

        kl = {"L": [], "R": []}
        kl[K0].append(Plant(F_PROF[K0], PSK, -1e3, -1e3 + 1, D0 + T_K0 - 1.5, D0 + T_K0, hs=0.0, to=8.0, air=True))
        kl[S0].append(Plant(tp(S0), -90.0, -1e3, -1e3 + 1, D0 + T_T0 - 0.5, D0 + T_T0 + 1.5, hs=0.0, to=8.0, air=True))
        kl[S0].append(pl3(F_S0, T_K0 - 3.0, T_K0 - 1.5, KS[1] - 1.5, KS[1], hs=-3.0, to=8.0, extra=heel_up))
        hz0 = {s: legs[s]["A0"][2] + self.sole for s in "LR"}
        for i in range(NK):
            K = KICK_K[i]
            s_, P_ = KS[i], kperiod(i)
            a_, b_ = legs[K]["a"], legs[K]["b"]
            hoff = YK @ (legs[K]["hip"][:2] - self.Jp[:2])
            alpha, knee, toe, warc = KC[i]
            wxy = warc

            F_prev = kl[K][-1].F.copy()
            F_next = land_F(i, xb)

            def arc(t, K=K, s_=s_, P_=P_, a_=a_, b_=b_, hoff=hoff, alpha=alpha, knee=knee, F_prev=F_prev, F_next=F_next, pe=0.46 + KICKS[i][2]):
                tau = t - D0
                u = (tau - s_) / P_
                al = math.radians(float(alpha(u)))
                sh = math.radians(float(alpha(u)) - float(knee(u)))
                pel = pelvis(tau)
                hz = hz0[K] + 0.97 * LEG[K] - d_sink(tau) + 0.02 * kick_lift(tau)
                xy = pel + np.array([d_lat(tau) * YK[0, 0], d_lat(tau) * YK[1, 0]]) + hoff + FB * (a_ * math.sin(al) + b_ * math.sin(sh))
                e_in = smoother((u - 0.14) / 0.3)
                xy = F_prev * (1 - e_in) + xy * e_in
                e_out = smoother((u - pe) / (0.86 - pe))
                xy = xy * (1 - e_out) + F_next * e_out
                return np.array([xy[0], xy[1], hz - a_* math.cos(al) - b_ * math.cos(sh)])

            land = s_ + P_ - 0.5
            leave = KS[i + 2] if i + 2 < NK else 1e5
            plant = pl3(land_F(i, xb), land, land + min(2.5, 0.45 * P_), leave - 1.5, leave, hs=24.0, to=8.0, extra=heel_up,
                        kick=(D0 + s_ + 0.5 * P_, arc, lambda t, s_=s_, P_=P_, toe=toe: float(toe((t - D0 - s_) / P_)), lambda t, s_=s_, P_=P_, warc=warc, wxy=wxy: (float(wxy((t - D0 - s_) / P_)), float(warc((t - D0 - s_) / P_)))))
            kl[K].append(plant)
        # After the last kick, and the turn, his feet are where the pivots put them; the left comes
        # home first (the right is on the floor), then the right is set out behind for the ta-da.
        T_RF = T_BOW - 2.0
        post = {
            "L": [Plant(F_Q["L"], -90.0, -1e3, -1e3 + 1, D0 + T_B1 + 0.5, D0 + T_B1 + 2.0, hs=0.0, to=8.0, air=True), pl3(P1 + Rq @ stand["L"], T_B1 + 4.5, T_B1 + 6.0, 1e6, 1e6 + 1, turn=-90.0, hs=-3.0, to=8.0)],
            "R": [
                Plant(F_Q["R"], -90.0, -1e3, -1e3 + 1, D0 + T_RF - 1.5, D0 + T_RF, hs=0.0, to=8.0, air=True),
                pl3(P1 + Rq @ (stand["R"] + np.array([-0.20, 0.10])), T_RF + 2.5, T_RF + 4.0, T_FIN_END + 1.0, T_FIN_END + 2.0, turn=-90.0, hs=34.0, to=34.0, fn=lambda t: 34.0),
                pl3(P1 + Rq @ stand["R"], T_END - 4.0, T_END - 2.0, 1e6, 1e6 + 1, turn=-90.0, hs=-3.0, to=8.0),
            ],
        }
        # (the plants after the dance, where it leaves him)
        plants["R"][5].t2, plants["R"][5].t3 = D0 - 2.0, D0
        plants["L"][6].t2, plants["L"][6].t3 = D0 - 2.0, D0
        plants["L"].insert(7, Plant(P1 + Rq @ stand["L"], -90.0, D0 + T_END - 2.0, D0 + T_END, t_go - 3, t_go, hs=-3.0, to=10.0, lift=0.03))
        plants["R"].insert(6, Plant(P1 + Rq @ stand["R"], -90.0, D0 + T_END - 2.0, D0 + T_END, r_back0 - 3, r_back0, hs=-3.0, to=8.0, lift=0.03))
        # (...and the feet of turning away and walking off, which were planned back where he began.)
        plants["R"][7].F = P1 + stand["R"]
        for k in range(0, 3):
            plants["L"][8 + k] = stride_plant("L", t_s2 + k * C, lift=0.036 if k else 0.04)
            plants["R"][8 + k] = stride_plant("R", t_s2 + k * C + C / 2)

        def foot_state(s, t):
            tau = t - D0
            if tau < 0.0 or t > D0 + T_END:
                return self.foot_at(s, plants[s], t)
            if tau < T_K0:
                if s == S0:
                    return self.foot_at(s, kl[s], t)
                return pivot(s, tau, B0[s], -90.0, PSK, T_T0 + 1.0, T_K0 - 1.0)
            if tau < T_K1:
                return self.foot_at(s, kl[s], t)
            if tau <= T_B1:
                return pivot(s, tau, F_END[s] + YK @ bvv(s), PSK, -90.0, T_K1 + 1.0, T_B1 - 1.0)
            return self.foot_at(s, post[s], t)

        def d_yaw(tau):
            return d_psi(tau)

        # The cane in his right hand, on his body's own axes (x across, y back,
        # z up; from his pelvis, turned with him). Described by the point on the
        # shaft his hand is at (G), the way the shaft points (u, from the tip
        # toward the knob) and how far below the knob his hand is.
        C_TW = np.array([-0.38, -0.32, 1.08])
        G_KC, U_KC, S_KC = np.array([-0.34, -0.12, 1.22]), unit([0.0, -0.95, 0.18]), 0.02
        F_KC, N_KC = np.array([1.0, 0.0, 0.0]), np.array([0.0, 0.0, -1.0])  # (fingers, palm) round the level cane
        G_BOW, U_BOW = np.array([-0.50, 0.05, 1.02]), unit([-0.12, 0.10, 0.95])
        G_FIN, U_FIN = np.array([-0.52, -0.05, 1.62]), unit([0.10, 0.0, -0.99])
        T_TO = T_K0 - 2.0  # the cane is across his chest by here

        def kick_pose(tau):
            """The cane through the kick line: it lives. It pumps up with each kick, the tip
            flicking up as the leg goes, out and back on the step, the wrist turning."""
            L = max(0.0, kick_lift(tau - 1.5)) * d_ln(tau)
            osc = math.sin(2 * math.pi * (tau - T_NOD) / BEAT)
            G = G_KC + np.array([0.02 * osc * (1 - L), -0.04 * L, 0.08 * L])
            u = unit(U_KC + np.array([0.20 * osc * (1 - L), 0.0, -0.40 * L]))
            return G, u

        def cane_dance(tau):
            """(G, u, s_g, u_hand, share of the level-cane grip): the dance's cane."""
            if tau < T_TW1:
                th = 2 * math.pi * smoother((tau - T_TW0) / (T_TW1 - T_TW0))
                u = np.array([-math.sin(th), 0.0, math.cos(th)])
                sgd = float(keyed([(T_LIFT0, 0.0), (T_TW0, 0.04), (T_TW0 + 3.0, 0.33), (T_TW1, 0.33)])(tau))
                G = C_TW.copy()
                G[2] = C_TW[2] - 0.12 * (1.0 - smoother((tau - T_LIFT0) / 4.0))
                return G, u, sgd, unit([0.0, 0.0, 1.0]), 0.0
            hk = smoother((tau - T_TW1) / (T_TO - T_TW1)) * (1.0 - smoother((tau - (T_B1 - 4.0)) / 4.0))
            if tau < T_B1 - 2.0:
                e = smoother((tau - T_TW1) / (T_TO - T_TW1))
                Gk, uk = kick_pose(tau)
                u = unit(lerp([0.0, 0.0, 1.0], uk, e))
                G = lerp(C_TW, Gk, e)
                return G, u, 0.33 + (S_KC - 0.33) * e, u, hk
            if tau < T_BOW + 5.0:
                # The bow: the cane hangs at his side, out and back from his hand.
                Gk, uk = kick_pose(T_B1 - 2.0)
                e = smoother((tau - (T_B1 - 2.0)) / 6.0)
                e2 = smoother((tau - (T_BOW - 8.0)) / 12.0)
                u = slerp_dir(slerp_dir(uk, U_BOW, e), U_FIN, e2)
                G = lerp(lerp(Gk, G_BOW, e), G_FIN, e2)
                return G, u, S_KC + (0.20 - S_KC) * e2, u, hk
            G = G_FIN + np.array([0.0, 0.0, 0.012 * math.sin(2 * math.pi * (tau - T_FIN) / 14.0)])
            return G, U_FIN, 0.20, U_FIN, 0.0

        def wc_cane(tau):
            """How much of the cane is the dance's: it leaves the ground as his
            hand lifts it, and comes back to be set down at the end."""
            return smoother((tau - 3.0) / 5.0) * (1.0 - smoother((tau - (T_FIN_END - 2.0)) / (T_END - T_FIN_END + 1.0)))

        # His boater. Worn, it sits on his head (a little forward and to one side,
        # tipped on the beat through the climb); otherwise his left hand has it by
        # the front of the brim and it goes where the hand does: behind his back
        # (out of sight), out and up to his head, off again at the bow, swept
        # across him and held high at the ta-da, and back behind him.
        HAT_BEHIND = [0.04, 0.26, 1.0, -90.0, 0.0, 0.0]
        HAT_UP = [0.52, 0.0, 1.82, -20.0, 0.0, -15.0]
        held_a = keyed([(4.0, HAT_BEHIND), (8.0, [0.36, 0.12, 1.12, -55.0, 0.0, 15.0]), (12.0, [0.30, -0.06, 1.94, -12.0, 0.0, 10.0]), (15.0, [0.02, -0.05, 2.0, 4.0, 0.0, 0.0])])
        held_b = keyed([
            (T_B1 + 1.0, [0.02, -0.20, 1.98, -10.0, 0.0, 0.0]),
            (T_B1 + 6.0, [0.30, -0.50, 1.62, -40.0, 0.0, 15.0]),
            (T_B1 + 11.0, [-0.05, -0.66, 1.15, -75.0, 0.0, -10.0]),
            (T_BOW - 4.0, [0.0, -0.64, 1.22, -72.0, 0.0, -8.0]),
            (T_BOW + 1.0, [0.30, -0.50, 1.55, -50.0, 0.0, -8.0]),
            (T_FIN + 5.0, HAT_UP),
            (T_FIN_END, HAT_UP),
            (T_FIN_END + 3.0, [0.50, 0.20, 1.40, -60.0, 0.0, 0.0]),
            (T_FIN_END + 6.0, HAT_BEHIND),
        ])
        HAT_REST = np.array([0.0, -0.047, 1.724])  # (the middle of its brim on his head, in his head's own rest coordinates)

        def hat_worn_share(tau):
            return smoother((tau - 13.0) / 4.0) * (1.0 - smoother((tau - (T_B1 + 1.0)) / 5.0))

        def hat_visible(tau):
            return 4.0 <= tau <= T_FIN_END + 6.0

        def hat_hand_w(tau):
            """How much his left hand has the hat's brim (otherwise it is on the cane)."""
            return smoother((tau - 1.0) / 3.0) * (1.0 - smoother((tau - (T_FIN_END + 6.0)) / (T_END - T_FIN_END - 7.0)))

        def hat_tip(tau):
            """He tips the brim on the beat through the climb (degrees, forward)."""
            return sum(10.0 * bump(tau, KS[i] + 0.25 * kperiod(i), KS[i] + 0.9 * kperiod(i)) for i in range(2, 6))

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

        def d_talk(tau):
            """His mouth open for the ta-da."""
            return 0.8 * bump(tau, T_FIN - 1.0, T_FIN + 8.0)

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
                return pelvis(tau) + YK @ np.array([d_lat(tau), 0.0]), psi + d_yaw(tau), rot(x=-d_tilt(tau), y=d_hike(tau))
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

        frames = [max(float(f) + shift, tw) for f in range(0, int(math.ceil(t_end)))]
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
            pop = accent(tau) * ln
            # He leans back as a counterbalance in proportion to the kick, a frame or two behind the leg.
            kb = kick_lift(tau - 1.0) * ln
            kh = kick_lift(tau - 2.0) * ln
            _after(R, "spine02", rot(x=-1.0 * ln - 4.0 * kb))
            _after(R, "spine04", rot(x=-1.0 * ln - 3.0 * kb))
            # ...but his head comes forward, to the house, over the lean (not up at the sky).
            _after(R, "neck01", rot(x=2.0 * ln + 2.0 * kh))
            _after(R, "head", rot(x=3.0 * ln + 3.0 * kh - 3.0 * pop))
            # The beat: his shoulders pop, a frame after the foot.
            _after(R, "clavicle.L", rot(y=-3.5 * pop))
            _after(R, "clavicle.R", rot(y=3.5 * pop))
            # The bow.
            bw = bow_amt(tau)
            _after(R, "spine02", rot(x=14.0 * bw))
            _after(R, "spine04", rot(x=10.0 * bw))
            _after(R, "neck01", rot(x=10.0 * bw))
            _after(R, "head", rot(x=-4.0 * bw))
            # The cue: a small, sly nod, the eyes staying on you.
            nod = keyed([(0.0, 0.0), (1.0, -0.2), (3.0, 1.0), (6.0, 0.2), (9.0, 0.0)])
            nn, nh = float(nod(tau - 1.0)), float(nod(tau - 2.0))
            _after(R, "neck01", rot(x=9.0 * nn))
            _after(R, "head", rot(x=8.0 * nh))
            for s in "LR":
                R[f"eye.{s}"] = R[f"eye.{s}"] @ rot(x=-14.0 * nh)
            # Turned toward the line, his head turns the rest of the way to the house, his eyes on you.
            dp = d_psi(tau)
            if dp > 0.0:
                for bone, deg in HEAD:
                    _after(R, bone, rot(z=-deg * min(0.95, dp / 68.0)))
                for s in "LR":
                    R[f"eye.{s}"] = R[f"eye.{s}"] @ rot(z=-EYES * 0.5 * dp / 50.0)
            # The ta-da: head cocked, chest up, shoulders flung back, a breath held for a beat and a half.
            fin = smoother((tau - (T_FIN - 4.0)) / 5.0) * (1.0 - smoother((tau - (T_FIN_END - 1.0)) / 8.0))
            breath = 0.5 - 0.5 * math.cos(2 * math.pi * max(0.0, tau - T_FIN) / 14.0)
            _after(R, "head", rot(x=-4.0 * fin, y=-9.0 * fin))
            _after(R, "spine02", rot(x=-5.0 * fin - 1.5 * breath * fin))
            _after(R, "spine04", rot(x=-1.5 * breath * fin))
            _after(R, "clavicle.L", rot(y=-4.0 * fin - 1.5 * breath * fin))
            _after(R, "clavicle.R", rot(y=4.0 * fin + 1.5 * breath * fin))

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
                self.step(R, root, s, A, G, toe, fwd + yaw(psi) @ np.array([0.12 * out_x, 0.0, 0.0]), own=out_x if 0.0 <= tau <= T_END else None)
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
                u_cane = slerp_dir(u_cane, uw, wcn)
                tip = top - u_cane * self.L
                if tip[2] < 0.0:
                    top = top - np.array([0.0, 0.0, tip[2]])
                    tip[2] = 0.0
                fv, iv = Yp @ np.array([0.0, -1.0, 0.0]), Yp @ np.array([1.0, 0.0, 0.0])
                f_d = unit(fv - (fv @ uhw) * uhw)
                Sr = self.at(self.fk(R, root), "upperarm01.R", self.heads[self.idx["upperarm01.R"]])
                n_d = unit(iv - (iv @ uhw) * uhw - (iv @ f_d) * f_d)
                if hk > 0.0:
                    f_d, n_d = unit(lerp(f_d, Yp @ F_KC, hk)), unit(lerp(n_d, Yp @ N_KC, hk))
                # (his fist follows his forearm: a hand is not turned square to it)
                fore_r = unit(Gw - Sr)
                f_d = unit(f_d + 0.9 * fore_r)
                target_r = lerp(target_r, Gw - n_d * 0.02 - f_d * 0.025, wcn)
                fing_r, palm_r = lerp(fing_r, f_d, wcn), lerp(palm_r, n_d, wcn)
                pole_w = lerp(pole_w, Yp @ np.array([-0.9, 0.9, -0.15]), min(1.0, 3.0 * wcn))
                curl_r = curl_r + (0.85 - curl_r) * wcn
            if wcn > 0.0:
                self.reach2(R, root, "R", target_r, fing_r, palm_r, pole_w, follow=0.8 * wcn)
            else:
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
                    pg = (hatM @ np.array([0.11, -0.135, 0.012, 1.0]))[:3]
                    Sl = self.at(self.fk(R, root), "upperarm01.L", self.heads[self.idx["upperarm01.L"]])
                    fg = unit(0.35 * (hatM[:3, :3] @ unit([0.0, 1.0, 0.1])) + 0.65 * unit(pg - Sl))
                    ng = hatM[:3, :3] @ np.array([0.0, 0.0, -1.0])
                    swing = 4.0 * wh * (1.0 - wh)
                    target = lerp(target, pg, wh) + Yp @ (np.array([0.30, 0.0, -0.05]) * swing)
                    fing_l, palm_l = unit(lerp(fing_l, fg, wh)), unit(lerp(palm_l, ng, wh))
                    pole_l = lerp(pole_l, Yp @ np.array([0.7, 0.5, 1.7]), min(1.0, 2.0 * wh))
                if wh > 0.0:
                    self.reach2(R, root, "L", target, fing_l, palm_l, pole_l, follow=0.95 * wh)
                else:
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
            out.append(dict(R=R, root=root, cane=M, blink=blink, talk=(d_talk(tau) if 0.0 <= tau <= T_END else 0.0), talk2=0.0, hat=(hatM if (hatM is not None and hat_visible(tau)) else None), hips=float(xy[1]) if D0 <= t <= D0 + T_END else float(hips_y(t)), rec=rec))
        return out

    def joint_check(self, take):
        """Every joint inside a real human range, on every frame: for each frame and
        side, how far each joint is turned in its own frame (the pelvis's sideways axis and
        the limb's own direction, never world axes), and the frames that break a limit.
        Returns (flags, summary): flags is [(frame, joint, value, limit)]."""
        h, tl, i = self.heads, self.tails, self.idx
        P = lambda D, b, p: self.at(D, b, p)

        def ang(u, v):
            return math.degrees(math.atan2(float(np.linalg.norm(np.cross(u, v))), float(u @ v)))

        def sang(u, v, axis):
            return math.degrees(math.atan2(float((np.cross(u, v)) @ axis), float(u @ v)))

        flags = []
        lo = dict(knee=1e9, hip=1e9, elbow_fwd=-1e9)
        hi = dict(knee=-1e9, hip=-1e9, abduction=-1e9, lean_back=-1e9, lean_fwd=-1e9, twist=-1e9, neck_flex=-1e9, neck_ext=-1e9, wrist=-1e9, elbow=-1e9, floor=-1e9)
        low_pts = {}
        prev = None
        for fi, f in enumerate(take):
            rec = f["rec"]
            name = "frame%d" % fi if rec is None else ("%s-%02d" % rec if rec[0] == "walk" else "scene-%03d" % rec[1])

            def flag(joint, v, limit):
                flags.append((name, joint, round(float(v), 1), limit))

            D = self.fk(f["R"], f["root"])
            root = f["root"]
            lat = unit(root[:3, 0])
            down = -unit(root[:3, 2])
            fwd = -unit(root[:3, 1])
            pel = (root @ np.append(self.Jp, 1.0))[:3]
            for s in "LR":
                H = P(D, f"upperleg01.{s}", h[i[f"upperleg01.{s}"]])
                K = P(D, f"lowerleg01.{s}", h[i[f"lowerleg01.{s}"]])
                A = P(D, f"foot.{s}", h[i[f"foot.{s}"]])
                t, sh = K - H, A - K
                knee = sang(t, sh, lat)  # positive: the shin swung back from the thigh (the way a knee bends)
                hip = -sang(down, t, lat)  # positive: the thigh swung forward
                abd = math.degrees(math.asin(float(np.clip(unit(t) @ lat, -1, 1)))) * (1.0 if s == "L" else -1.0)
                lo["knee"], hi["knee"] = min(lo["knee"], knee), max(hi["knee"], knee)
                lo["hip"], hi["hip"] = min(lo["hip"], hip), max(hi["hip"], hip)
                hi["abduction"] = max(hi["abduction"], abs(abd))
                if knee < -5.0:
                    flag("%s knee hyperextended (backward)" % s, knee, -5)
                if knee > 140.0:
                    flag("%s knee flexion" % s, knee, 140)
                if hip > 130.0:
                    flag("%s hip flexion" % s, hip, 130)
                if hip < -30.0:
                    flag("%s hip extension" % s, hip, -30)
                if abs(abd) > 45.0:
                    flag("%s hip abduction" % s, abd, 45)
                # Arms.
                S_ = P(D, f"upperarm01.{s}", h[i[f"upperarm01.{s}"]])
                E = P(D, f"lowerarm01.{s}", h[i[f"lowerarm01.{s}"]])
                Wr = P(D, f"wrist.{s}", h[i[f"wrist.{s}"]])
                inner = ang(S_ - E, Wr - E)
                elbow = 180.0 - inner
                line = unit(Wr - S_)
                off = E - (S_ + line * float((E - S_) @ line))
                hi["elbow"] = max(hi["elbow"], elbow)
                fwdness = float(off @ fwd)
                if elbow > 150.0:
                    flag("%s elbow flexion" % s, elbow, 150)
                if fwdness > 0.04 and elbow > 20.0:
                    flag("%s elbow points forward (bent the wrong way)" % s, fwdness * 100, "4 cm")
                pc = P(D, f"wrist.{s}", self.hand0[s]["pc"])
                wr = ang(Wr - E, pc - Wr)
                hi["wrist"] = max(hi["wrist"], wr)
                # (70 degrees in the dance; the cane carried in his fist, walking and standing, is allowed what a fist round a cane needs)
                wlim = 70.0 if (rec is not None and rec[0] == "scene" and self.dance_frames[0] <= rec[1] <= self.dance_frames[1]) else 125.0
                if wr > wlim:
                    flag("%s wrist" % s, wr, wlim)
                # Feet: the lowest of heel and ball must not go below the floor.
                leg = self.legs[s]
                heel = P(D, f"foot.{s}", leg["A0"] + leg["hv"])
                ball = P(D, f"foot.{s}", leg["A0"] + leg["bv"])
                low = min(heel[2], ball[2]) - self.sole
                hi["floor"] = max(hi["floor"], -low)
                if low < -0.006:
                    flag("%s foot through the floor" % s, low * 100, "-0.6 cm")
                # ...and a foot on the floor does not slide (the lowest point stays put).
                which = "heel" if heel[2] <= ball[2] else "ball"
                low_pts[(fi, s)] = (heel if which == "heel" else ball, low, which)
            # Spine, neck.
            neck = P(D, "neck01", h[i["neck01"]])
            c = neck - pel
            fwd_h = unit(np.array([fwd[0], fwd[1], 0.0]))
            lean = math.degrees(math.atan2(float(c @ fwd_h), float(c[2])))
            hi["lean_back"], hi["lean_fwd"] = max(hi["lean_back"], -lean), max(hi["lean_fwd"], lean)
            if -lean > 20.0:
                flag("spine leans back", -lean, 20)
            if lean > 60.0:
                flag("spine leans forward", lean, 60)

            def eul(R3):
                return math.degrees(math.atan2(R3[2, 1], R3[2, 2])), math.degrees(-math.asin(float(np.clip(R3[2, 0], -1, 1)))), math.degrees(math.atan2(R3[1, 0], R3[0, 0]))

            Rb = f["R"]
            e2, e4, en, eh = eul(Rb.get("spine02", np.eye(3))), eul(Rb.get("spine04", np.eye(3))), eul(Rb.get("neck01", np.eye(3))), eul(Rb.get("head", np.eye(3)))
            twist = abs(e2[2] + e4[2])
            hi["twist"] = max(hi["twist"], twist)
            if twist > 45.0:
                flag("spine twist", twist, 45)
            nflex = en[0] + eh[0]
            hi["neck_flex"], hi["neck_ext"] = max(hi["neck_flex"], nflex), max(hi["neck_ext"], -nflex)
            if nflex > 55.0 or nflex < -50.0:
                flag("neck flexion/extension", nflex, "+55/-50")
            nrot = abs(e2[2] + e4[2] + en[2] + eh[2])
            if nrot > 95.0:
                flag("head turn", nrot, 95)
        # A foot on the floor slides.
        for fi in range(len(take) - 1):
            for s in "LR":
                (p0, l0, w0), (p1, l1, w1) = low_pts[(fi, s)], low_pts[(fi + 1, s)]
                if l0 < 0.012 and l1 < 0.012 and w0 == w1:
                    d = float(np.linalg.norm((p1 - p0)[:2]))
                    rec = take[fi]["rec"]
                    # (turning on the ball of the foot moves the heel: only the ball is held)
                    if d > 0.045:
                        flags.append(("scene-%03d" % rec[1] if rec and rec[0] == "scene" else ("%s-%02d" % rec if rec else "frame%d" % fi), "%s foot slides" % s, round(d * 100, 1), "4.5 cm a frame"))
        summary = dict(kneeMin=round(lo["knee"], 1), kneeMax=round(hi["knee"], 1), hipMax=round(hi["hip"], 1), hipMin=round(lo["hip"], 1), abductionMax=round(hi["abduction"], 1), leanBackMax=round(hi["lean_back"], 1), leanForwardMax=round(hi["lean_fwd"], 1), twistMax=round(hi["twist"], 1), wristMax=round(hi["wrist"], 1), elbowMax=round(hi["elbow"], 1), floorMax=round(hi["floor"] * 100, 1))
        return flags, summary

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
