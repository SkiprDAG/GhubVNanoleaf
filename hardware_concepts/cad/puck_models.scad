// ====================================================================
// Smart Halo Puck - Master Parametric 3D Printable Enclosure (OpenSCAD)
// Optimized for:
// - Waveshare ESP32-S3-Touch-LCD-1.28 (Ø 38.5mm glass, Ø 36.5mm PCB)
// - Thin section bearing 6808-2RS (ID: 40mm, OD: 52mm, Width: 7mm)
// - AS5600 Magnetic Encoder + Geared Pinion with Ø 6mm Magnet
// - Li-Po Battery 803040 / 603040 (30 x 40 x 8 mm)
// - Built-in wire routing channels, bearing relief shoulders, and USB-C
// ====================================================================

$fn = 120; // High resolution curves for smooth rotation and finish

// --- Tolerances & Clearances (FDM 3D printing optimized) ---
f_tol       = 0.15; // Radial fit tolerance (for bearing & board press-fit)
axial_gap   = 0.50; // Gap between rotating ring and base to prevent rubbing

// --- Component Dimensions ---
bearing_id  = 40.0; // 6808-2RS Inner Diameter
bearing_od  = 52.0; // 6808-2RS Outer Diameter
bearing_w   = 7.0;  // 6808-2RS Width

screen_glass_dia = 39.0; // Front touch glass diameter
screen_pcb_dia   = 36.8; // Internal round PCB diameter
screen_depth     = 10.5; // PCB + LCD glass assembly depth

magnet_dia  = 6.0;  // Neodymium magnet diameter
magnet_len  = 2.5;  // Neodymium magnet length

battery_w   = 32.0; // Li-Po Battery width
battery_l   = 42.0; // Li-Po Battery length
battery_h   = 9.0;  // Li-Po Battery thickness

ring_od     = 66.0; // Outer knob diameter
ring_h      = 12.0; // Height of the rotating ring

base_od     = 66.0; // Outer base diameter
base_h      = 18.0; // Total height of stationary base

// ====================================================================
// MODULE 1: ROTATING BEZEL RING (Внешнее поворотное кольцо)
// ====================================================================
module RotatingBezelRing() {
    difference() {
        union() {
            // Main cylindrical body
            cylinder(h = ring_h - 1.0, d = ring_od);
            // Top ergonomic chamfer
            translate([0, 0, ring_h - 1.0])
                cylinder(h = 1.0, d1 = ring_od, d2 = ring_od - 2.0);
        }
        
        // 1. Central viewing window for display glass
        translate([0, 0, -1])
            cylinder(h = ring_h + 3, d = screen_glass_dia + 1.0);
            
        // 2. Bearing outer race socket (press-fit 52mm with +0.1mm tolerance)
        translate([0, 0, -0.1])
            cylinder(h = bearing_w + 0.2, d = bearing_od + f_tol);
            
        // 3. Bearing outer-race stop shoulder (leaves clearance for inner race & seals)
        translate([0, 0, bearing_w])
            cylinder(h = 1.2, d = bearing_od - 2.0);

        // 4. Internal geared ring track for magnetic pinion driving (зубчатый венец)
        translate([0, 0, -0.2])
            difference() {
                cylinder(h = 3.5, d = ring_od - 4.0);
                cylinder(h = 4.0, d = bearing_od + f_tol);
            }

        // 5. Ergonomic diamond knurling flutes around perimeter
        for (a = [0 : 4 : 360]) {
            rotate([0, 0, a])
                translate([ring_od/2, 0, -1])
                    cylinder(h = ring_h + 3, d = 1.5, $fn=16);
        }
    }
    
    // Bold internal gear teeth (зубья внутреннего венца)
    for (i = [0 : 48]) {
        rotate([0, 0, i * (360 / 48)])
            translate([26.2, 0, 0.2])
                linear_extrude(height = 3.0)
                    polygon(points = [
                        [0.0, -0.9],
                        [1.8, -0.5],
                        [1.8,  0.5],
                        [0.0,  0.9]
                    ]);
    }
}

// ====================================================================
// MODULE 2: BASE HOUSING (Основной неподвижный корпус)
// ====================================================================
module BaseHousing() {
    lower_h = base_h - ring_h + axial_gap; // Lower body height (6.5mm)
    
    difference() {
        union() {
            // Lower stationary base body with bottom chamfer
            cylinder(h = lower_h, d = base_od);
            
            // Bearing inner-race support tower (fits 40mm bearing inner diameter)
            translate([0, 0, lower_h])
                cylinder(h = bearing_w - 0.2, d = bearing_id - f_tol);
                
            // Pinion pivot axle pin (смещен под внешнее кольцо на X=26.5мм)
            translate([26.5, 0, lower_h - 2.0])
                cylinder(h = 4.0, d = 1.9, $fn=32);
        }
        
        // 1. Central well for Waveshare ESP32-S3 round PCB
        translate([0, 0, 3.5])
            cylinder(h = base_h + 10, d = screen_pcb_dia + 1.2);
            
        // 2. Display glass perimeter resting shelf
        translate([0, 0, base_h - 1.2])
            cylinder(h = 4, d = screen_glass_dia + 0.8);
            
        // 3. Lower battery compartment cavity (fits 30x40x9mm LiPo)
        translate([-battery_w/2, -battery_l/2, 1.8])
            cube([battery_w, battery_l, battery_h]);
            
        // 4. AS5600 Encoder sensor mounting pocket (под шестерней на X=26.5)
        translate([20.5, -6.0, lower_h - 4.5])
            cube([12.5, 12.0, 3.5]);

        // 5. DRV2605L & 10mm Vibration motor pocket
        translate([-16.0, -16.0, 2.0])
            cylinder(h = 3.2, d = 10.6); // 10mm coin motor
            
        // 6. WIRE ROUTING CHANNELS (Проходные каналы для кабелей батареи и I2C)
        translate([0, 12.0, 1.5])
            cube([10.0, 6.0, lower_h + 2], center=true); // Battery wire slot
        translate([-12.0, 0, 1.5])
            cube([6.0, 8.0, lower_h + 2], center=true);  // I2C wire slot

        // 7. USB Type-C rear pass-through port (чисто по центру нижней стенки)
        translate([0, base_od/2 + 5.0, 3.2])
            rotate([90, 0, 0])
                hull() {
                    translate([-4.2, 0, 0]) cylinder(h = 22, d = 3.6);
                    translate([ 4.2, 0, 0]) cylinder(h = 22, d = 3.6);
                }
                
        // 8. M2 Screw mounting holes (4x) for bottom lid
        for (pos = [ [18, 18], [-18, 18], [18, -18], [-18, -18] ]) {
            translate([pos[0], pos[1], -0.5])
                cylinder(h = 6, d = 2.0, $fn=24);
        }
    }
}

// ====================================================================
// MODULE 3: BOTTOM LID (Нижняя крышка с ножками и зенковкой)
// ====================================================================
module BottomLid() {
    difference() {
        cylinder(h = 2.5, d = base_od - 0.8);
        
        // Countersunk M2 screw holes (4x)
        for (pos = [ [18, 18], [-18, 18], [18, -18], [-18, -18] ]) {
            translate([pos[0], pos[1], -1])
                cylinder(h = 5, d = 2.4, $fn=24);
            translate([pos[0], pos[1], 1.0])
                cylinder(h = 2.0, d1 = 2.4, d2 = 4.4, $fn=24);
        }
        
        // Anti-slip rubber foot pads recesses (4x Ø 8.2mm x 1.0mm)
        for (pos = [ [21, 0], [-21, 0], [0, 21], [0, -21] ]) {
            translate([pos[0], pos[1], -0.2])
                cylinder(h = 1.2, d = 8.2, $fn=32);
        }
    }
}

// ====================================================================
// MODULE 4: MAGNETIC PINION GEAR (Ведомая шестерня с четкими зубьями)
// ====================================================================
module MagneticPinionGear() {
    num_teeth = 12;
    pitch_r   = 5.6;   // Начальный радиус
    addendum  = 1.6;   // Высота зуба наружу (+1.6мм)
    dedendum  = 1.4;   // Глубина впадины внутрь (-1.4мм)
    
    difference() {
        union() {
            // Центральная ступица шестерни
            cylinder(h = 4.5, r = pitch_r - dedendum, $fn=64);
            
            // 12 Рельефных, четко выраженных зубьев шестерни
            for (i = [0 : num_teeth - 1]) {
                rotate([0, 0, i * (360 / num_teeth)])
                    linear_extrude(height = 4.5)
                        polygon(points = [
                            [pitch_r - dedendum - 0.2, -1.3],
                            [pitch_r + addendum, -0.6],
                            [pitch_r + addendum,  0.6],
                            [pitch_r - dedendum - 0.2,  1.3]
                        ]);
            }
        }
        
        // Центральное гнездо под неодимовый магнит Ø6мм x 2.5мм
        translate([0, 0, 4.5 - magnet_len - 0.1])
            cylinder(h = magnet_len + 0.5, d = magnet_dia + f_tol, $fn=48);
            
        // Центральное осевое отверстие под ось корпуса Ø1.9мм
        translate([0, 0, -0.5])
            cylinder(h = 3.0, d = 2.1, $fn=32);
    }
}

// ====================================================================
// RENDER SELECTOR
// 0 = Full Color Assembled View (with simulated Screen & Bearing)
// 1 = Rotating Bezel Ring (Export to 1_Rotating_Bezel_Ring.stl)
// 2 = Base Housing        (Export to 2_Base_Housing.stl)
// 3 = Bottom Lid          (Export to 3_Bottom_Lid.stl)
// 4 = Magnetic Pinion     (Export to 4_Magnetic_Pinion_Gear.stl)
// ====================================================================
mode = 1;

if (mode == 0) {
    // 1. 3D Printable Housing Parts (Assembled flush)
    color([0.22, 0.22, 0.22]) BaseHousing();
    color([0.65, 0.65, 0.70]) translate([0, 0, base_h - ring_h + axial_gap]) RotatingBezelRing();
    color([0.12, 0.12, 0.12]) translate([0, 0, -2.5]) BottomLid();
    color([0.85, 0.50, 0.10]) translate([26.5, 0, base_h - ring_h + axial_gap - 1.0]) MagneticPinionGear();

    // 2. Simulated Hardware Components:
    // 6808-2RS Steel Bearing (inside ring)
    color([0.80, 0.82, 0.85, 0.9])
        translate([0, 0, base_h - ring_h + axial_gap + 0.2])
            difference() {
                cylinder(h = bearing_w, d = bearing_od);
                translate([0, 0, -0.5]) cylinder(h = bearing_w + 1, d = bearing_id);
            }

    // Waveshare 1.28" Round Touch Glass
    color([0.06, 0.08, 0.10, 0.98])
        translate([0, 0, base_h - 1.2])
            cylinder(h = 1.2, d = screen_glass_dia);
            
    // Crisp Cyan UI Ring
    color([0.0, 0.85, 0.95])
        translate([0, 0, base_h + 0.15])
            difference() {
                cylinder(h = 0.08, d = 30.0);
                translate([0, 0, -0.05]) cylinder(h = 0.20, d = 26.0);
            }
} else if (mode == 1) {
    RotatingBezelRing();
} else if (mode == 2) {
    BaseHousing();
} else if (mode == 3) {
    BottomLid();
} else if (mode == 4) {
    MagneticPinionGear();
}


