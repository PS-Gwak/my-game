"""손 B 모델 → hands/hand-b.js (게임싸개 · 2026-10-29)
Hand_low_R.gltf(Godot XR Tools 손, CC0)와 피부 그림(512px jpg)을 글자로 바꿔 한 파일에 담는다.
이유: index.html을 더블클릭으로 열면(file://) 옆 파일을 fetch로 못 읽어서 <script>로 함께 싣는다(sfx/sets.js와 같은 방법).
실행: python3 build-hand-b.py   (이 폴더에서)
"""
import base64, json, pathlib
H = pathlib.Path(__file__).resolve().parent
g = json.loads((H / "Hand_low_R.gltf").read_text())
skin = "data:image/jpeg;base64," + base64.b64encode((H / "hand-b-skin-512.jpg").read_bytes()).decode("ascii")
body = ("// 자동 생성 — build-hand-b.py가 Hand_low_R.gltf(Godot XR Tools 손, CC0)와 피부 그림을 글자로 담음. 직접 고치지 말 것\n"
        "window.BB_HAND_B = " + json.dumps({"gltf": g, "skin": skin}) + ";\n")
(H / "hand-b.js").write_text(body, encoding="utf-8")
print(f"hand-b.js: {(H / 'hand-b.js').stat().st_size / 1024:.0f} KB")
