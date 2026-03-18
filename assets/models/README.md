# assets/models

Place GLTF / GLB engine model files here.

When a real model is available, replace the procedural geometry in
`engine/loadEngineModel.js` with a GLTFLoader call:

```js
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load('./assets/models/v10.glb', (gltf) => {
  scene.add(gltf.scene);
});
```
