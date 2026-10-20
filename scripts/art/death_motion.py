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
  his hand leaves the cane; he turns away (his eyes the last to leave you),
  steps off and walks on: the scene ends on the stride before the looped
  one, so the walk carries him off.
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

    def __init__(self, F, turn, t0, t1, t2, t3, hs=-14.0, to=32.0, lift=0.05):
        self.F = np.asarray(F, float)
        self.turn, self.t0, self.t1, self.t2, self.t3 = turn, t0, t1, t2, t3
        self.hs, self.to, self.lift = hs, to, lift

    def pitch(self, t):
        if t < self.t1:
            return self.hs * (1 - ease((t - self.t0) / max(1e-6, self.t1 - self.t0)))
        if t < self.t2:
            return 0.0
        return self.to * ease((t - self.t2) / max(1e-6, self.t3 - self.t2)) ** 1.3


class Motion:
    def __init__(self, person, sole):
        b = person.bodyd
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
                return A, yaw(turn) @ rot(x=th), 0.0, False
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
        t_release = t_regard + nH
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

        def pace(t):
            """How fast he is walking, as a share of his stride's pace."""
            return max(0.0, min(1.0, (hips_y(t - 0.5) - hips_y(t + 0.5)) / v))

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

        # ── His cane: where its tip is set down, and where his hand would be.
        A_hand = 0.08
        side_tip = np.array([X0 + self.cane_x, Ye - 0.13, 0.0])
        front_tip = np.array([X0 - (abs(self.cane_x) + 0.02), Ye, 0.0])
        side_knob = np.array([side_tip[0] + 0.025, Ye])

        def stride_tip(t0):
            return np.array([X0 + self.cane_x, hips_y(t0) + self.hand_y - d / 4, 0.0])

        canes = []  # (planted at, lifted at, tip)
        for k in range(-1, 4):
            t0 = tw + k * C
            canes.append((t0, t0 + C / 2, stride_tip(t0)))
        canes.append((ts + C, t_turn + 0.2 * nF, side_tip))
        canes.append((t_turn + 0.75 * nF, t_back + 0.1 * nJ, front_tip))
        for k in range(0, 3):
            t0 = t_s2 + k * C
            canes.append((t0, t0 + C / 2, stride_tip(t0)))

        def front_knob(psi):
            return P_end + yaw(psi)[:2, :2] @ np.array([0.0, -(abs(self.cane_x) - 0.05)])

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
                return lerp(side_knob, front_knob(psi), smoother(-psi / 90.0))
            if t < t_s2:
                return lerp(front_knob(-90.0), stride_knob(t_s2), smoother((t - t_back) / (t_s2 - t_back)))
            return stride_knob(t)

        def cane_at(t, psi):
            """(tip, top) of the cane: planted, or swinging under his hand to
            where it will be planted next (clear of the ground)."""
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
            return np.array([X0 + sway + shift[0], hips_y(t) + shift[1]]), psi, rot(y=drop * 0.6, z=turn)

        def root_of(xy, psi, Rloc, z):
            M = np.eye(4)
            M[:3, :3] = yaw(psi) @ Rloc
            M[:3, 3] = np.array([xy[0], xy[1], z]) - M[:3, :3] @ self.Jp
            return M

        frames = [max(float(f), tw) for f in range(0, int(math.ceil(t_end)))]

        # ── How high his hips ride: as high as his planted legs reach, the leg
        # he stands on all but straight (a walk rises over each step and dips
        # a little as the weight passes from one foot to the other).
        def reach_height(t):
            xy, psi, Rloc = hips_at(t)
            root = root_of(xy, psi, Rloc, 0.0)
            still = 1.0 - pace(t)
            zs = []
            for s in "LR":
                A, _, _, down = self.foot_at(s, plants[s], t)
                leg = self.legs[s]
                hip = (root @ np.append(leg["hip"], 1.0))[:3]
                reach = (0.998 + 0.0015 * still) * (leg["a"] + leg["b"])
                r = math.hypot(A[0] - hip[0], A[1] - hip[1])
                if down or A[2] < leg["A0"][2] + self.sole + 0.02:
                    zs.append(A[2] + math.sqrt(max(0.0, reach * reach - r * r)) - hip[2])
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
        z_hips = np.minimum(z - over, raw)
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
            wm.curl(R, "L", 0.5)
            return R

        def on_knob(t):
            """0: his fist round the cane under the knob; 1: his palm on the
            knob (his hands at rest on it, facing you)."""
            return smoother((t - t_hands) / (0.6 * nG)) * (1.0 - smoother((t - t_release) / nI))

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
            if t_hands <= t < t_back + nJ:
                u = smoother((t - t_hands) / nG) * (1.0 - smoother((t - t_release) / (nI + nJ * 0.5)))
                _after(R, "spine02", rot(x=2.0 * u))
                tilt = smoother((t - t_regard) / nH) * (1.0 - smoother((t - t_release) / nI))
                _after(R, "head", rot(x=1.5 * u, y=-3.5 * tilt))
            # The legs.
            fwd = yaw(psi) @ np.array([0.0, -1.0, 0.0])
            for s, out_x in (("L", 1.0), ("R", -1.0)):
                A, G, toe, _ = self.foot_at(s, plants[s], t)
                self.step(R, root, s, A, G, toe, fwd + yaw(psi) @ np.array([0.12 * out_x, 0.0, 0.0]))
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
            self.reach(R, root, "R", lerp(grip, on, k), lerp(f_grip, yaw(psi) @ f_body, k), lerp(n_grip, -u_cane, k), yaw(psi) @ np.array([-0.5, 1.0, -0.1]))
            wm.curl(R, "R", 0.88 - 0.33 * k)
            # His left hand comes to rest on his right, and leaves it again.
            if t_hands <= t < t_back:
                if left_from is None:
                    left_from = (self.palm_of(R, root, "L"), *self.hand_dirs(R, root, "L"))
                right = self.palm_of(R, root, "R")
                on = right + yaw(psi) @ np.array([-0.004, -0.012, 0.0]) + np.array([0.0, 0.0, 0.042])
                on_dirs = (yaw(psi) @ np.array([-0.55, -1.0, -0.1]), np.array([0.0, 0.0, -1.0]))
                if t < t_release:
                    u = (t - t_hands) / nG
                    e = smoother(u)
                    start = left_from
                    lift = bump(u)
                else:
                    if left_back is None:
                        R0 = upper(t_back)
                        left_back = (self.palm_of(R0, root, "L"), *self.hand_dirs(R0, root, "L"))
                    u = (t - t_release) / nI
                    e = 1.0 - smoother(u)
                    start = left_back
                    lift = bump(u)
                target = lerp(start[0], on, e) + np.array([0.0, 0.0, 0.035]) * lift
                self.reach(R, root, "L", target, lerp(start[1], on_dirs[0], e), lerp(start[2], on_dirs[1], e), yaw(psi) @ np.array([0.6, 0.8, -0.1]))
                wm.curl(R, "L", 0.5 - 0.26 * e)
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
            out.append(dict(R=R, root=root, cane=M, blink=blink, hips=float(hips_y(t)), rec=rec))
        return out

    def _knob(self, tip, xy):
        """The top of the cane over `tip`, toward (x, y), on the sphere of its length."""
        dx, dy = xy[0] - tip[0], xy[1] - tip[1]
        return np.array([xy[0], xy[1], tip[2] + math.sqrt(max(1e-6, self.L**2 - dx * dx - dy * dy))])
