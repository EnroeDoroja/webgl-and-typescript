import * as chroma from "chroma-js";
import * as twgl from "twgl.js";
import {m4} from "twgl.js";
import basic from "./shader/basic/basic";

const degToRad = (d: number) => {
  return d * Math.PI / 180;
};

const rand = (min: number, max?: number) => {
  if (max === undefined) {
    max = min;
    min = 0;
  }

  return min + Math.random() * (max - min);
};

window.onload = () => {
  const canvas = <HTMLCanvasElement> document.getElementById("canvas");
  const gl = <WebGL2RenderingContext>canvas.getContext("webgl2");
  if (!gl) {
    return;
  }

  const resize = () => {
    const desiredWidth = window.innerWidth;
    const desiredHeight = window.innerHeight;
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.style.width = `${desiredWidth}px`;
    canvas.style.height = `${desiredHeight}px`;
    canvas.width = desiredWidth * devicePixelRatio;
    canvas.height = desiredHeight * devicePixelRatio;
  };

  window.addEventListener('resize', resize);

  resize();

  const plane = twgl.primitives.createPlaneBuffers(gl, 60, 60);

  // setup GLSL program
  const program = twgl.createProgramFromSources(gl, [basic.vs, basic.fs]);
  const uniformSetters = twgl.createUniformSetters(gl, program);
  const attribSetters  = twgl.createAttributeSetters(gl, program);

  const attribs = {
    a_position: { buffer: plane.position, numComponents: 3, },
    a_normal: { buffer: plane.normal, numComponents: 3, },
    a_texcoord: { buffer: plane.texcoord, numComponents: 2, },
  };

  const vao = twgl.createVAOAndSetAttributes(gl, attribSetters, attribs, plane.indices);

  const fieldOfViewRadians = degToRad(60);

  const uniformsThatAreTheSameForAllObjects = {
    u_lightWorldPos: [-50, 30, 100],
    u_viewInverse: m4.identity(),
    u_lightColor: [1, 1, 1, 1],
  };

  const uniformsThatAreComputedForEachObject = {
    u_worldViewProjection: m4.identity(),
    u_world: m4.identity(),
    u_worldInverseTranspose: m4.identity(),
  };

  interface CheckerTextureOptions {
    width?: number;
    height?: number;
    color1?: string;
    color2?: string;
  }

  const ctx = document.createElement("canvas").getContext("2d");

  const makeTexture = function(gl: WebGLRenderingContext) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ctx.canvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return tex;
  };

  const makeCheckerTexture = function(gl: WebGLRenderingContext, options: CheckerTextureOptions) {
    const width  = options.width  || 2;
    const height = options.height || 2;
    const color1 = options.color1 || "white";
    const color2 = options.color2 || "black";

    ctx.canvas.width  = width;
    ctx.canvas.height = height;
    ctx.fillStyle = color1 || "white";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = color2 || "black";
    ctx.fillRect(0, 0, width / 2, height / 2);
    ctx.fillRect(width / 2, height / 2, width / 2, height / 2);

    return makeTexture(gl);
  };

  const texture = makeCheckerTexture(gl, {
    color1: "#FFF",
    color2: "#CCC"
  });

  const baseColor = rand(240);
  const objects = [{
    yRotation: Math.PI / 4,
    materialUniforms: {
      u_colorMult: chroma.hsv(rand(baseColor, baseColor + 120), 0.5, 1).gl(),
      u_diffuse: texture,
      u_specular: [1, 1, 1, 1],
      u_shininess: rand(500),
      u_specularFactor: rand(1),
    },
  }];

  const drawScene = () => {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    // Compute the projection matrix
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projectionMatrix = m4.perspective(fieldOfViewRadians, aspect, 1, 2000);

    // Compute the camera's matrix using look at
    const cameraPosition = [0, 50, 100];
    const target = [0, 0, 0];
    const up = [0, 1, 0];
    const cameraMatrix = m4.lookAt(cameraPosition, target, up, uniformsThatAreTheSameForAllObjects.u_viewInverse);

    // Make a view matrix from the camera matrix
    const viewMatrix = m4.inverse(cameraMatrix);
    const viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

    gl.useProgram(program);

    // Setup all the needed attributes
    gl.bindVertexArray(vao);

    // Set the uniforms that are the same for all objects
    twgl.setUniforms(uniformSetters, uniformsThatAreTheSameForAllObjects);

    objects.forEach(function(object) {
      const worldMatrix = m4.rotateY(m4.identity(), object.yRotation);
      m4.multiply(viewProjectionMatrix, worldMatrix, uniformsThatAreComputedForEachObject.u_worldViewProjection);
      m4.transpose(m4.inverse(worldMatrix), uniformsThatAreComputedForEachObject.u_worldInverseTranspose);

      // Set the uniforms we just computed
      twgl.setUniforms(uniformSetters, uniformsThatAreComputedForEachObject);

      // Set the uniforms that are specific to the this object
      twgl.setUniforms(uniformSetters, object.materialUniforms);

      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    });

    requestAnimationFrame(drawScene);
  }

  requestAnimationFrame(drawScene);
};
