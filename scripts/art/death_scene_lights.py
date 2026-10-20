"""The light Death is rendered in (death_scene.py)."""
import bpy
import numpy as np
from mathutils import Vector


def lights(scene):
    """A cold key from the front and above on the camera's left, two hard
    rims from behind that cut his black outline out of the dark, and a
    little fill so the black has some shape."""
    world = bpy.data.worlds.new("death-world")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.022, 0.026, 0.034, 1.0)
    bg.inputs["Strength"].default_value = 1.0

    def area(name, loc, energy, color, size, target=(0.0, 0.0, 1.25)):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.color = color
        data.size = size
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        obj.location = loc
        d = np.array(target) - np.array(loc)
        obj.rotation_euler = Vector(d.tolist()).to_track_quat("-Z", "Y").to_euler()
        return obj

    area("death-key", (-1.6, -2.6, 2.9), 420.0, (0.86, 0.9, 1.0), 1.2)
    area("death-rim-r", (2.0, 1.8, 2.3), 520.0, (0.78, 0.86, 1.0), 0.6)
    area("death-rim-l", (-2.2, 2.0, 2.0), 380.0, (0.78, 0.86, 1.0), 0.6)
    area("death-fill", (1.8, -3.0, 1.0), 45.0, (0.62, 0.68, 0.8), 2.5)
    scene.view_settings.exposure = -1.5
