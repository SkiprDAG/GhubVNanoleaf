import struct
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from mpl_toolkits.mplot3d.art3d import Poly3DCollection


def load_stl(filepath: Path) -> np.ndarray:
    """Reads binary STL file and returns Nx3x3 array of vertices."""
    with open(filepath, "rb") as f:
        _ = f.read(80)
        num_triangles = struct.unpack("<I", f.read(4))[0]

        triangles = np.empty((num_triangles, 3, 3), dtype=np.float32)
        for i in range(num_triangles):
            data = struct.unpack("<3f 3f 3f 3f H", f.read(50))
            triangles[i, 0] = data[3:6]
            triangles[i, 1] = data[6:9]
            triangles[i, 2] = data[9:12]

    return triangles

def shade_triangles(triangles: np.ndarray, base_color: tuple, light_dir: np.ndarray) -> list:
    """Computes directional light shading for 3D faces."""
    v0 = triangles[:, 0, :]
    v1 = triangles[:, 1, :]
    v2 = triangles[:, 2, :]
    normals = np.cross(v1 - v0, v2 - v0)
    lens = np.linalg.norm(normals, axis=1, keepdims=True)
    lens[lens == 0] = 1.0
    normals = normals / lens

    light_dir = light_dir / np.linalg.norm(light_dir)
    dot = np.sum(normals * light_dir, axis=1)
    intensity = np.clip(dot * 0.5 + 0.5, 0.25, 1.0)

    r, g, b = base_color
    colors = [ (r * it, g * it, b * it, 1.0) for it in intensity ]
    return colors

def render_stl_view(stl_paths_and_colors: list, out_path: Path, elev: float = 30, azim: float = -60, title: str = ""):
    fig = plt.figure(figsize=(12, 8), dpi=150, facecolor="#14161C")
    ax = fig.add_subplot(111, projection="3d", facecolor="#14161C")

    light_dir = np.array([0.6, -0.8, 1.2])
    all_verts = []

    for path, color, z_offset in stl_paths_and_colors:
        triangles = load_stl(path).copy()
        triangles[:, :, 2] += z_offset
        all_verts.append(triangles.reshape(-1, 3))

        face_colors = shade_triangles(triangles, color, light_dir)
        poly = Poly3DCollection(triangles, facecolors=face_colors, edgecolors=(0,0,0,0.05), linewidths=0.2)
        ax.add_collection3d(poly)

    concat_verts = np.vstack(all_verts)
    max_range = np.array([
        concat_verts[:, 0].max() - concat_verts[:, 0].min(),
        concat_verts[:, 1].max() - concat_verts[:, 1].min(),
        concat_verts[:, 2].max() - concat_verts[:, 2].min()
    ]).max() / 2.0

    mid_x = (concat_verts[:, 0].max() + concat_verts[:, 0].min()) * 0.5
    mid_y = (concat_verts[:, 1].max() + concat_verts[:, 1].min()) * 0.5
    mid_z = (concat_verts[:, 2].max() + concat_verts[:, 2].min()) * 0.5

    ax.set_xlim(mid_x - max_range, mid_x + max_range)
    ax.set_ylim(mid_y - max_range, mid_y + max_range)
    ax.set_zlim(mid_z - max_range, mid_z + max_range)

    ax.view_init(elev=elev, azim=azim)
    ax.set_axis_off()

    if title:
        plt.title(title, color="#E2E8F0", fontsize=15, pad=-20, fontweight="bold")

    plt.tight_layout()
    plt.savefig(out_path, facecolor=fig.get_facecolor(), bbox_inches="tight", pad_inches=0.1)
    plt.close(fig)
    print(f"Saved: {out_path.name}")

if __name__ == "__main__":
    stl_dir = Path(r"d:\project\GhubVNanoleaf\hardware_concepts\stl")
    out_dir = Path(r"d:\project\GhubVNanoleaf\hardware_concepts")

    # 1. Bezel Ring Isometric
    render_stl_view(
        [(stl_dir / "1_Rotating_Bezel_Ring.stl", (0.75, 0.78, 0.82), 0)],
        out_dir / "real_render_1_bezel_ring.png",
        elev=35, azim=-45, title="1_Rotating_Bezel_Ring (Top Isometric View)"
    )

    # 2. Bezel Ring Underside (Bearing Pocket)
    render_stl_view(
        [(stl_dir / "1_Rotating_Bezel_Ring.stl", (0.75, 0.78, 0.82), 0)],
        out_dir / "real_render_1_ring_underside.png",
        elev=-45, azim=-45, title="1_Rotating_Bezel_Ring (Underside Bearing Pocket Ø52mm)"
    )

    # 3. Base Housing Inside Cavity
    render_stl_view(
        [(stl_dir / "2_Base_Housing.stl", (0.35, 0.38, 0.45), 0)],
        out_dir / "real_render_2_base_inside.png",
        elev=55, azim=-55, title="2_Base_Housing (Internal Battery & Screen Wells)"
    )

    # 4. Base Housing USB-C Profile
    render_stl_view(
        [(stl_dir / "2_Base_Housing.stl", (0.35, 0.38, 0.45), 0)],
        out_dir / "real_render_2_base_usbc.png",
        elev=15, azim=90, title="2_Base_Housing (Side View: USB-C Pass-Through Port)"
    )

    # 5. Bottom Lid
    render_stl_view(
        [(stl_dir / "3_Bottom_Lid.stl", (0.25, 0.28, 0.32), 0)],
        out_dir / "real_render_3_bottom_lid.png",
        elev=40, azim=-60, title="3_Bottom_Lid (Screw Holes & Rubber Foot Pockets)"
    )

    # 6. Magnetic Pinion Gear (Bold 12 teeth view)
    render_stl_view(
        [(stl_dir / "4_Magnetic_Pinion_Gear.stl", (0.95, 0.55, 0.10), 0)],
        out_dir / "real_render_4_pinion_gear.png",
        elev=48, azim=-35, title="4_Magnetic_Pinion_Gear (12 Bold Teeth & Magnet Pocket Ø6mm)"
    )

    # 7. Complete Assembly (Base + Ring + Lid + Pinion)
    render_stl_view(
        [
            (stl_dir / "2_Base_Housing.stl", (0.28, 0.30, 0.35), 0),
            (stl_dir / "1_Rotating_Bezel_Ring.stl", (0.75, 0.78, 0.82), 6.5),
            (stl_dir / "3_Bottom_Lid.stl", (0.18, 0.20, 0.22), -2.5),
            (stl_dir / "4_Magnetic_Pinion_Gear.stl", (0.95, 0.60, 0.15), 6.0),
        ],
        out_dir / "real_render_0_full_assembly.png",
        elev=32, azim=-50, title="Smart Halo Puck (Assembled 3D CAD Stack)"
    )
