"""Write self-contained glTF 2.0 binary scenes."""

from json import dumps
from struct import pack


class Glb:
    def __init__(self, attribution, *, compact_normals=False, compact_positions=False):
        self.bin = bytearray()
        self.doc = {
            "asset": {
                "version": "2.0",
                "generator": "Reunite Bangmod study model",
                "copyright": attribution,
            },
            "scene": 0,
            "scenes": [],
            "nodes": [],
            "meshes": [],
            "materials": [],
            "accessors": [],
            "bufferViews": [],
            "buffers": [],
        }
        self.compact_normals = compact_normals
        self.compact_positions = compact_positions
        self.position_grid = None
        if compact_normals or compact_positions:
            self.doc["extensionsUsed"] = ["KHR_mesh_quantization"]
            self.doc["extensionsRequired"] = ["KHR_mesh_quantization"]
        self.materials = {}

    def mesh_coordinates(self, minimum=None, maximum=None):
        """Use one uniform local grid per mesh, preserving normals and shared edges."""
        self.position_grid = None
        if not self.compact_positions or minimum is None:
            return {}
        step = max(b - a for a, b in zip(minimum, maximum)) / 65535
        if step <= 0 or step > 0.002:
            raise ValueError("Position quantization exceeds the 2 mm grid budget")
        self.position_grid = (minimum, step)
        return {"translation": list(minimum), "scale": [step] * 3}

    def positions(self, values):
        if self.position_grid is None:
            return self.vectors(values, position=True)
        origin, step = self.position_grid
        integers = [
            tuple(round((v - o) / step) for v, o in zip(point, origin))
            for point in values
        ]
        axes = list(zip(*integers))
        if any(min(axis) < 0 or max(axis) > 65535 for axis in axes):
            raise ValueError("Mesh leaves its quantized position grid")
        data = b"".join(pack("<3H2x", *point) for point in integers)
        return self.accessor(
            data, 5123, "VEC3", 34962, len(values),
            ([min(a) for a in axes], [max(a) for a in axes]), stride=8,
        )

    def append(self, kind, data):
        entries = self.doc[kind]
        entries.append(data)
        return len(entries) - 1

    def accessor(
        self,
        data,
        component,
        type_,
        target,
        count,
        bounds=None,
        *,
        stride=None,
        normalized=False,
    ):
        self.bin.extend(bytes(-len(self.bin) % 4))
        view = self.append(
            "bufferViews",
            {
                "buffer": 0,
                "byteOffset": len(self.bin),
                "byteLength": len(data),
                "target": target,
            },
        )
        if stride is not None:
            self.doc["bufferViews"][view]["byteStride"] = stride
        self.bin.extend(data)
        result = {
            "bufferView": view,
            "componentType": component,
            "type": type_,
            "count": count,
        }
        if bounds:
            result.update(min=bounds[0], max=bounds[1])
        if normalized:
            result["normalized"] = True
        return self.append("accessors", result)

    def vectors(self, values, *, position=False):
        # Calculate glTF bounds from the same float32 values sent to the GPU.
        from struct import iter_unpack

        data = b"".join(pack("<3f", *value) for value in values)
        bounds = None
        if position:
            axes = list(zip(*iter_unpack("<3f", data)))
            bounds = ([min(a) for a in axes], [max(a) for a in axes])
        return self.accessor(data, 5126, "VEC3", 34962, len(values), bounds)

    def material(self, name, rgb, *, metallic=0, roughness=1):
        if name not in self.materials:
            linear = [
                c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb
            ]
            self.materials[name] = self.append(
                "materials",
                {
                    "name": name,
                    "pbrMetallicRoughness": {
                        "baseColorFactor": [*linear, 1],
                        "metallicFactor": metallic,
                        "roughnessFactor": roughness,
                    },
                },
            )
        return self.materials[name]

    def normals(self, values):
        if not self.compact_normals:
            return self.vectors(values)
        data = b"".join(
            pack("<3bx", *(round(axis * 127) for axis in v)) for v in values
        )
        return self.accessor(
            data, 5120, "VEC3", 34962, len(values), stride=4, normalized=True
        )

    def lettering(self, png):
        self.bin.extend(bytes(-len(self.bin) % 4))
        view = self.append(
            "bufferViews",
            {"buffer": 0, "byteOffset": len(self.bin), "byteLength": len(png)},
        )
        self.bin.extend(png)
        self.doc["images"] = [{"bufferView": view, "mimeType": "image/png"}]
        self.doc["textures"] = [{"source": 0}]
        material = self.material("Bangmod sign lettering", (1, 1, 1), roughness=0.79)
        definition = self.doc["materials"][material]
        definition["pbrMetallicRoughness"]["baseColorTexture"] = {"index": 0}
        definition.update(alphaMode="MASK", alphaCutoff=0.4)
        return material

    def primitive(self, surface, material, *, uvs=None, derive_flat_normals=False):
        count = len(surface.indices)
        if len(surface.positions) > 65535:
            indices, component = pack(f"<{count}I", *surface.indices), 5125
        else:
            indices, component = pack(f"<{count}H", *surface.indices), 5123
        attributes = {"POSITION": self.positions(surface.positions)}
        # glTF permits deriving flat face normals from triangle winding.
        # The caller selects eligible surfaces; the writer rejects smooth shading.
        if derive_flat_normals:
            for start in range(0, len(surface.indices), 3):
                normals = [surface.normals[index] for index in surface.indices[start:start + 3]]
                if not normals[0] == normals[1] == normals[2]:
                    raise ValueError("A smoothed surface requires authored normals")
        else:
            attributes["NORMAL"] = self.normals(surface.normals)
        result = {
            "attributes": attributes,
            "indices": self.accessor(indices, component, "SCALAR", 34963, count),
            "material": material,
        }
        if uvs is not None:
            if len(uvs) != len(surface.positions):
                raise ValueError("Texture coordinates and vertices disagree")
            data = b"".join(pack("<2f", *uv) for uv in uvs)
            result["attributes"]["TEXCOORD_0"] = self.accessor(
                data, 5126, "VEC2", 34962, len(uvs)
            )
        return result

    def encode(self):
        self.doc["buffers"] = [{"byteLength": len(self.bin)}]
        payload = dumps(self.doc, ensure_ascii=False, separators=(",", ":")).encode(
            "utf-8"
        )
        payload += b" " * (-len(payload) % 4)
        binary = self.bin + bytes(-len(self.bin) % 4)
        return b"".join(
            (
                pack("<4sII", b"glTF", 2, 28 + len(payload) + len(binary)),
                pack("<I4s", len(payload), b"JSON"),
                payload,
                pack("<I4s", len(binary), b"BIN\0"),
                binary,
            )
        )
