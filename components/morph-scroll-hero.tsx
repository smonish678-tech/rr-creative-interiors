"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Scene = {
  src: string;
  kicker: string;
  title: string;
  body: string;
  side: string;
};

const SCENES: Scene[] = [
  {
    src: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=2600&q=88",
    kicker: "01 · YOUR BRIEF",
    title: "Your taste.|Your terms.",
    body: "Every project starts with how you live, what you value, what needs to work better and what you want to invest. The design follows your brief—not a fixed package.",
    side: "Personal by design."
  },
  {
    src: "/rr-media/hero/Interior%20Inspiration.jpg",
    kicker: "02 · MADE TO FIT",
    title: "Nothing|off the shelf.",
    body: "Layouts, storage, finishes and furniture are tailored to your space. We begin with what is possible, then make deliberate choices around what matters most.",
    side: "Customised to your space."
  },
  {
    src: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=2600&q=88",
    kicker: "03 · EVERYDAY USE",
    title: "Designed|for real life.",
    body: "Movement, light, storage and everyday routines come before decoration. A beautiful room should also make ordinary days work better.",
    side: "Function is part of the design."
  },
  {
    src: "/rr-media/hero/download.jpg",
    kicker: "04 · THOUGHTFUL CHOICES",
    title: "Spend where|it matters.",
    body: "Not every surface needs to be a statement. We help weigh material, durability, finish and priorities so the budget works harder without losing the character of the space.",
    side: "Good choices beat excess."
  },
  {
    src: "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=2600&q=88",
    kicker: "05 · CRAFT & DETAIL",
    title: "Made to measure.|Made to last.",
    body: "From cabinetry and hardware to lighting and the meeting of materials, small decisions are planned to work together—and to stand up to daily use.",
    side: "The detail is the difference."
  },
  {
    src: "/rr-media/hero/%23modern%20%23reception%20%23interior.jpg",
    kicker: "06 · COST CLARITY",
    title: "Custom design.|Clear scope.",
    body: "Before work begins, discuss the inclusions, finish levels and priorities. If the scope needs to change, talk through the options and cost before proceeding.",
    side: "No guesswork in the brief."
  },
  {
    src: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=2600&q=88",
    kicker: "07 · YOUR KIND OF SPACE",
    title: "A whole home.|Or one room.",
    body: "From a complete turnkey interior to a kitchen, wardrobe, renovation or design-only brief, the right scope depends on what your project actually needs.",
    side: "The service fits the project."
  },
  {
    src: "/rr-media/hero/download%20%281%29.jpg",
    kicker: "08 · THE RESULT",
    title: "Thoughtful design.|Thoughtfully priced.",
    body: "A space should feel unmistakably yours—not expensive for the sake of it. We bring design thinking, practical decisions and a clear plan to the place you call your own.",
    side: "Made for you. Planned with care."
  }
];

const VERT = `
attribute vec2 a_position;
varying vec2 v_uv;
void main(){v_uv=a_position*0.5+0.5;gl_Position=vec4(a_position,0.0,1.0);}
`;

const FRAG = `
precision highp float;
uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float u_progress;
uniform vec2 u_resolution;
uniform float u_fromAspect;
uniform float u_toAspect;
uniform float u_scale;
uniform float u_direction;
uniform float u_edge;
uniform float u_drift;
varying vec2 v_uv;
vec3 permute(vec3 x){return mod(((x*34.0)+1.0)*x,289.0);}
float snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy));
  vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=x0.x>x0.y?vec2(1.0,0.0):vec2(0.0,1.0);
  vec4 x12=x0.xyxy+C.xxzz;
  x12.xy-=i1;
  i=mod(i,289.0);
  vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
  m=m*m;m=m*m;
  vec3 x=2.0*fract(p*C.www)-1.0;
  vec3 h=abs(x)-0.5;
  vec3 ox=floor(x+0.5);
  vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.0*dot(m,g);
}
float fbm(vec2 v){
  float value=0.0;float amplitude=0.5;
  for(int i=0;i<5;i++){value+=amplitude*snoise(v);v*=2.0;amplitude*=0.5;}
  return value;
}
vec2 mirror(vec2 uv){return 1.0-abs(1.0-mod(uv,2.0));}
vec2 coverUV(vec2 uv,float aspect){
  float canvasAspect=u_resolution.x/u_resolution.y;
  vec2 scale=canvasAspect>aspect?vec2(1.0,aspect/canvasAspect):vec2(canvasAspect/aspect,1.0);
  return mirror((uv-0.5)*scale+0.5);
}
void main(){
  float adjusted=u_progress*(1.0+2.0*u_edge)-u_edge;
  float noise=fbm(v_uv*u_scale+vec2(u_progress*u_direction,0.0))*0.5+0.5;
  float lum=dot(texture2D(u_to,coverUV(v_uv,u_toAspect)).rgb,vec3(0.299,0.587,0.114));
  noise=mix(noise,smoothstep(0.0,1.0,lum),0.30);
  float mixFactor=1.0-smoothstep(adjusted-u_edge,adjusted+u_edge,noise);
  vec2 fromUV=coverUV(v_uv+vec2(noise*u_progress*u_drift*u_direction,0.0),u_fromAspect);
  vec2 toUV=coverUV(v_uv+vec2(noise*(1.0-u_progress)*-0.5*u_drift*u_direction,0.0),u_toAspect);
  gl_FragColor=mix(texture2D(u_from,fromUV),texture2D(u_to,toUV),mixFactor);
}
`;

export default function MorphScrollHero({ assets = {} }: { assets?: Partial<Record<string, string>> }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackRefs = useRef<(HTMLImageElement | null)[]>([]);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [shaderReady, setShaderReady] = useState(false);
  const rafRef = useRef(0);
  const readyRef = useRef(false);
  const runtimeRef = useRef<{
    gl: WebGLRenderingContext;
    program: WebGLProgram;
    textures: (WebGLTexture | null)[];
    aspects: number[];
    uniforms: Record<string, WebGLUniformLocation | null>;
  } | null>(null);
  const sceneIndexRef = useRef(0);

  const scenes = useMemo(() => scenes.map((scene, index) => ({ ...scene, src: assets[`heroScene${index + 1}`] || scene.src })), [assets]);
  const titleLines = useMemo(() => scenes[sceneIndex].title.split("|"), [scenes, sceneIndex]);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;

    const gl =
      canvas.getContext("webgl", { alpha: false, antialias: false }) ??
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

    const setFallback = (index: number) => {
      fallbackRefs.current.forEach((img, i) => {
        if (!img) return;
        img.style.opacity = i === index ? "1" : "0";
      });
    };

    setFallback(0);

    if (!gl) {
      return;
    }

    let disposed = false;
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;

    try {
      const compile = (type: number, source: string) => {
        const shader = gl.createShader(type);
        if (!shader) throw new Error("shader");
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          throw new Error(gl.getShaderInfoLog(shader) || "compile");
        }
        return shader;
      };

      const vertex = compile(gl.VERTEX_SHADER, VERT);
      const fragment = compile(gl.FRAGMENT_SHADER, FRAG);
      program = gl.createProgram();
      if (!program) throw new Error("program");
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || "link");
      }

      gl.useProgram(program);
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW
      );
      const pos = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(pos);
      gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

      const names = [
        "from",
        "to",
        "progress",
        "resolution",
        "fromAspect",
        "toAspect",
        "scale",
        "direction",
        "edge",
        "drift"
      ];
      const uniforms: Record<string, WebGLUniformLocation | null> = {};
      names.forEach((name) => {
        uniforms[name] = gl.getUniformLocation(program!, `u_${name}`);
      });

      const textures: (WebGLTexture | null)[] = new Array(scenes.length).fill(null);
      const aspects = new Array(scenes.length).fill(1);

      const upload = (img: HTMLImageElement, index: number) => {
        if (disposed) return;
        const tex = gl.createTexture();
        if (!tex) return;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        textures[index] = tex;
        aspects[index] = img.naturalWidth / Math.max(img.naturalHeight, 1);
      };

      Promise.all(
        scenes.map(
          (scene, index) =>
            new Promise<void>((resolve) => {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.decoding = "async";
              img.onload = () => {
                upload(img, index);
                resolve();
              };
              img.onerror = () => resolve();
              img.src = scene.src;
            })
        )
      ).then(() => {
        if (disposed) return;
        readyRef.current = textures.some(Boolean);
        runtimeRef.current = {
          gl,
          program: program!,
          textures,
          aspects,
          uniforms,
        };
        resize();
        if (readyRef.current) {
          setShaderReady(true);
        }
      });

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
        const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      };

      const onResize = () => resize();
      window.addEventListener("resize", onResize);
      resize();

      return () => {
        disposed = true;
        cancelAnimationFrame(rafRef.current);
        window.removeEventListener("resize", onResize);
        textures.forEach((texture) => texture && gl.deleteTexture(texture));
        if (buffer) gl.deleteBuffer(buffer);
        if (program) gl.deleteProgram(program);
        runtimeRef.current = null;
      };
    } catch {
      setShaderReady(false);
      return;
    }
  }, [scenes]);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;

    const render = () => {
      const runtime = runtimeRef.current;
      const rect = section.getBoundingClientRect();
      const total = Math.max(section.offsetHeight - window.innerHeight, 1);
      const progress = Math.min(Math.max(-rect.top / total, 0), 1);
      const scaled = progress * (scenes.length - 1);
      const nextIndex = Math.min(scenes.length - 1, Math.floor(scaled));
      const local = scaled - nextIndex;

      if (nextIndex !== sceneIndexRef.current) {
        sceneIndexRef.current = nextIndex;
        setSceneIndex(nextIndex);
      }

      fallbackRefs.current.forEach((img, index) => {
        if (img) img.style.opacity = index === nextIndex ? "1" : "0";
      });

      if (runtime && readyRef.current) {
        const fromIndex = nextIndex;
        const toIndex = Math.min(scenes.length - 1, nextIndex + 1);
        const fromTex = runtime.textures[fromIndex] || runtime.textures.find(Boolean);
        const toTex = runtime.textures[toIndex] || runtime.textures.find(Boolean);
        if (fromTex && toTex) {
          const { gl, uniforms, aspects } = runtime;
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, fromTex);
          gl.uniform1i(uniforms.from, 0);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, toTex);
          gl.uniform1i(uniforms.to, 1);
          gl.uniform1f(uniforms.progress, local);
          gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
          gl.uniform1f(uniforms.fromAspect, aspects[fromIndex] || 1);
          gl.uniform1f(uniforms.toAspect, aspects[toIndex] || 1);
          gl.uniform1f(uniforms.scale, 3.7);
          gl.uniform1f(uniforms.direction, 1);
          gl.uniform1f(uniforms.edge, 0.14);
          gl.uniform1f(uniforms.drift, 0.42);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [scenes]);

  return (
    <section ref={sectionRef} className="relative h-[860vh] bg-[#f7f4ee]">
      <div className="sticky top-0 h-screen overflow-hidden bg-[#f7f4ee]">
        <div className="absolute inset-0">
          {scenes.map((scene, index) => (
            <img
              key={scene.src}
              ref={(node) => {
                fallbackRefs.current[index] = node;
              }}
              src={scene.src}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
              style={{ opacity: index === 0 ? 1 : 0, filter: "saturate(.8) contrast(1.04)" }}
              aria-hidden="true"
            />
          ))}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full"
            style={{ opacity: shaderReady ? 1 : 0, transition: "opacity .35s ease" }}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(248,245,238,.93)_0%,rgba(248,245,238,.78)_38%,rgba(248,245,238,.16)_72%,rgba(248,245,238,.48)_100%),linear-gradient(180deg,rgba(248,245,238,.55),transparent_35%,rgba(248,245,238,.86)_100%)]" />
          <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(50,37,24,.08)]" />
          <div className="rr-glaze-line" aria-hidden="true" />
          <div className="rr-spark-field" aria-hidden="true">
            <i className="rr-spark" />
            <i className="rr-spark" />
            <i className="rr-spark" />
            <i className="rr-spark" />
            <i className="rr-spark" />
          </div>
        </div>

        <div className="absolute right-6 top-[96px] z-20 md:right-[6.4vw] md:top-[102px]">
          <div className="font-serif text-2xl text-white md:text-3xl">
            <span>{String(sceneIndex + 1).padStart(2, "0")}</span>
            <span className="mx-2 text-[#27231f]/30">/</span>
            <span className="font-sans text-[10px] tracking-[0.2em] text-[#27231f]/55">08</span>
          </div>
        </div>

        <div className="absolute bottom-20 left-6 z-20 w-[min(1040px,calc(100%-48px))] md:bottom-[12.5vh] md:left-[6.4vw]">
          <div className="mb-4 text-[10px] uppercase tracking-[0.28em] text-[#98683f]">
            {scenes[sceneIndex].kicker}
          </div>
          <h1 className="max-w-[1200px] font-serif text-[12vw] font-normal leading-[.84] tracking-[-0.055em] text-[#27231f] md:text-[7vw] lg:text-[6.65vw]">
            <span className="block">{titleLines[0]}</span>
            <span className="block whitespace-nowrap pl-[4.6vw] italic text-[#9d352a]">{titleLines[1]}</span>
          </h1>
          <p className="mt-6 max-w-[610px] text-[13px] leading-7 text-[#63584e] md:text-[15px] md:leading-8">
            {scenes[sceneIndex].body}
          </p>
          <a href="#contact" className="mt-7 inline-flex items-center gap-3 border-b border-[#9d352a] pb-2 text-[10px] uppercase tracking-[0.18em] text-[#27231f]">
            Explore the studio <span className="text-[#9d352a]">↗</span>
          </a>
        </div>

        <div className="absolute bottom-24 right-7 z-20 hidden flex-col items-end gap-4 md:flex">
          <div className="writing-vertical rotate-180 text-[8px] uppercase tracking-[0.22em] text-[#27231f]/55">
            {scenes[sceneIndex].side}
          </div>
          <div className="flex flex-col gap-2">
            {scenes.map((_, i) => (
              <span
                key={i}
                className={i === sceneIndex ? "h-14 w-[3px] bg-[#9d352a]" : "h-7 w-[2px] bg-white/25"}
              />
            ))}
          </div>
        </div>

        <div className="absolute bottom-7 left-6 right-6 z-20 flex items-center justify-between text-[8px] uppercase tracking-[0.2em] text-[#27231f]/52 md:left-10 md:right-10">
          <span>Scroll through the studio</span>
          <span>Interior design, tailored to you</span>
        </div>
      </div>
    </section>
  );
}