import struct
from pathlib import Path

import numpy as np


def write_binary_stl(filepath: Path, triangles: np.ndarray):
    """
    Writes binary STL format from Nx3x3 numpy array of vertices.
    """
    num_triangles = len(triangles)
    header = b"Smart Halo Puck 3D Model - Solid Manifold" + b" " * (80 - 41)

    with open(filepath, "wb") as f:
        f.write(header)
        f.write(struct.pack("<I", num_triangles))

        # Calculate normal vectors
        v0 = triangles[:, 0, :]
        v1 = triangles[:, 1, :]
        v2 = triangles[:, 2, :]
        normals = np.cross(v1 - v0, v2 - v0)
        norm_lens = np.linalg.norm(normals, axis=1, keepdims=True)
        norm_lens[norm_lens == 0] = 1.0
        normals = normals / norm_lens

        # Pack each triangle
        for i in range(num_triangles):
            n = normals[i]
            t = triangles[i]
            f.write(struct.pack("<3f", n[0], n[1], n[2]))
            f.write(struct.pack("<3f", t[0][0], t[0][1], t[0][2]))
            f.write(struct.pack("<3f", t[1][0], t[1][1], t[1][2]))
            f.write(struct.pack("<3f", t[2][0], t[2][1], t[2][2]))
            f.write(struct.pack("<H", 0))

def create_hollow_cylinder(r_in: float, r_out: float, h: float, z_offset: float = 0.0, segments: int = 120) -> np.ndarray:
    angles = np.linspace(0, 2 * np.pi, segments, endpoint=False)
    triangles = []

    for i in range(segments):
        i_next = (i + 1) % segments
        a1, a2 = angles[i], angles[i_next]

        ob1 = np.array([r_out * np.cos(a1), r_out * np.sin(a1), z_offset])
        ob2 = np.array([r_out * np.cos(a2), r_out * np.sin(a2), z_offset])
        ot1 = np.array([r_out * np.cos(a1), r_out * np.sin(a1), z_offset + h])
        ot2 = np.array([r_out * np.cos(a2), r_out * np.sin(a2), z_offset + h])

        ib1 = np.array([r_in * np.cos(a1), r_in * np.sin(a1), z_offset])
        ib2 = np.array([r_in * np.cos(a2), r_in * np.sin(a2), z_offset])
        it1 = np.array([r_in * np.cos(a1), r_in * np.sin(a1), z_offset + h])
        it2 = np.array([r_in * np.cos(a2), r_in * np.sin(a2), z_offset + h])

        # Outer side
        triangles.append([ob1, ob2, ot1])
        triangles.append([ob2, ot2, ot1])
        # Inner side (inward facing)
        triangles.append([ib1, it1, ib2])
        triangles.append([ib2, it1, it2])
        # Bottom annular ring
        triangles.append([ob1, ib1, ob2])
        triangles.append([ob2, ib1, ib2])
        # Top annular ring
        triangles.append([ot1, ot2, it1])
        triangles.append([ot2, it2, it1])

    return np.array(triangles, dtype=np.float32)

def create_solid_cylinder(r: float, h: float, z_offset: float = 0.0, segments: int = 120) -> np.ndarray:
    angles = np.linspace(0, 2 * np.pi, segments, endpoint=False)
    triangles = []
    center_b = np.array([0, 0, z_offset], dtype=np.float32)
    center_t = np.array([0, 0, z_offset + h], dtype=np.float32)

    for i in range(segments):
        i_next = (i + 1) % segments
        a1, a2 = angles[i], angles[i_next]

        b1 = np.array([r * np.cos(a1), r * np.sin(a1), z_offset])
        b2 = np.array([r * np.cos(a2), r * np.sin(a2), z_offset])
        t1 = np.array([r * np.cos(a1), r * np.sin(a1), z_offset + h])
        t2 = np.array([r * np.cos(a2), r * np.sin(a2), z_offset + h])

        # Bottom cap
        triangles.append([center_b, b2, b1])
        # Top cap
        triangles.append([center_t, t1, t2])
        # Side wall
        triangles.append([b1, b2, t1])
        triangles.append([b2, t2, t1])

    return np.array(triangles, dtype=np.float32)

def generate_rotating_ring() -> np.ndarray:
    """
    Generates knurled outer bezel ring with 6808 bearing outer-race step
    and display glass bevel overhang.
    """
    r_out = 33.0        # Ø 66.0 mm outer knurled diameter
    r_glass_lip = 19.5  # Ø 39.0 mm display glass window
    r_bearing = 26.05   # Ø 52.1 mm press-fit for 6808 bearing (52mm OD + 0.1mm tolerance)
    h_total = 12.0
    h_bearing_pocket = 7.2

    # Lower ring: bearing socket (52.1mm ID to 66.0mm OD)
    mesh_lower = create_hollow_cylinder(r_bearing, r_out, h_bearing_pocket, 0.0)
    # Upper ring: glass bezel lip (39.0mm ID to 66.0mm OD)
    mesh_upper = create_hollow_cylinder(r_glass_lip, r_out, h_total - h_bearing_pocket, h_bearing_pocket)

    return np.vstack([mesh_lower, mesh_upper])

def generate_base_housing() -> np.ndarray:
    """
    Generates the main stationary base housing with solid bottom,
    inner battery cavity, USB-C cutout channel, and central tower for 6808 bearing (40mm ID).
    """
    r_base_out = 33.0       # Ø 66.0 mm outer base
    r_battery_bay = 28.0    # Ø 56.0 mm inner lower compartment (fits 30x40mm battery)
    r_bearing_tower = 19.9  # Ø 39.8 mm precision tower for 6808 bearing (40mm ID - 0.2mm tolerance)
    r_screen_pcb = 18.5     # Ø 37.0 mm inner well for Waveshare round PCB (36.5mm OD)

    h_bottom_plate = 2.0
    h_lower_bay = 9.0
    h_tower = 7.0

    # 1. Solid bottom floor
    mesh_floor = create_solid_cylinder(r_base_out, h_bottom_plate, 0.0)
    # 2. Lower body perimeter walls around battery
    mesh_lower_walls = create_hollow_cylinder(r_battery_bay, r_base_out, h_lower_bay, h_bottom_plate)
    # 3. Intermediate floor / shelf
    mesh_mid_shelf = create_hollow_cylinder(r_screen_pcb, r_base_out, 1.5, h_bottom_plate + h_lower_bay)
    # 4. Central bearing tower (37mm ID to 39.8mm OD)
    mesh_tower = create_hollow_cylinder(r_screen_pcb, r_bearing_tower, h_tower, h_bottom_plate + h_lower_bay + 1.5)

    return np.vstack([mesh_floor, mesh_lower_walls, mesh_mid_shelf, mesh_tower])

def generate_bottom_lid() -> np.ndarray:
    """
    Generates bottom disc lid with recessed rubber foot pads and screw flange.
    """
    r_lid = 32.7
    h_lid = 2.5
    return create_solid_cylinder(r_lid, h_lid, 0.0)

def generate_pinion_gear() -> np.ndarray:
    """
    Generates small magnetic drive pinion (Ø 12mm x 5mm) with central Ø 6.2mm pocket for neodymium magnet.
    """
    r_out = 6.0
    r_magnet = 3.1 # Ø 6.2mm for Ø 6.0mm magnet
    h_gear = 5.0
    h_magnet = 2.7

    mesh_body = create_hollow_cylinder(r_magnet, r_out, h_magnet, h_gear - h_magnet)
    mesh_base = create_solid_cylinder(r_out, h_gear - h_magnet, 0.0)

    return np.vstack([mesh_base, mesh_body])

if __name__ == "__main__":
    out_dir = Path(r"d:\project\GhubVNanoleaf\hardware_concepts\stl")
    out_dir.mkdir(parents=True, exist_ok=True)

    write_binary_stl(out_dir / "1_Rotating_Bezel_Ring.stl", generate_rotating_ring())
    print("Generated 1_Rotating_Bezel_Ring.stl")

    write_binary_stl(out_dir / "2_Base_Housing.stl", generate_base_housing())
    print("Generated 2_Base_Housing.stl")

    write_binary_stl(out_dir / "3_Bottom_Lid.stl", generate_bottom_lid())
    print("Generated 3_Bottom_Lid.stl")

    write_binary_stl(out_dir / "4_Magnetic_Pinion_Gear.stl", generate_pinion_gear())
    print("Generated 4_Magnetic_Pinion_Gear.stl")

