// 共用 GLSL 片段
export const NOISE = `
float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
`;

export const smokeFrag = `
  varying vec4 vCol; varying float vSeed;
  ${NOISE}
  void main(){
    vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0; if (r > 1.0) discard;
    float n = vnoise(vec3(c * 4.2 + vSeed * 17.0, vSeed * 3.0));
    float n2 = vnoise(vec3(c * 10.0 + vSeed * 5.0, 2.0 + vSeed));
    float a = 1.0 - smoothstep(0.15, 1.0, r); a *= a;
    a *= clamp(0.35 + 0.75 * n + 0.3 * n2 - 0.25, 0.0, 1.0);
    float shade = 0.82 + 0.38 * (-c.y) + 0.12 * n2;
    gl_FragColor = vec4(vCol.rgb * shade, clamp(a * vCol.a, 0.0, 1.0));
  }`;
export const lightingGLSL = `
  uniform vec3 uGlowPos; uniform float uGlow; uniform vec3 uAmb; uniform vec3 uSunCol; uniform float uFlood;
  const float RE = 6371000.0;
  vec3 lightAt(vec3 site, vec3 wp){
    float dep = max(0.0523 - site.x / RE * 0.8, 0.0);
    float alt = site.y + site.x * site.x / (2.0 * RE);
    float shadowH = RE * (1.0 / cos(dep) - 1.0);
    float sunlit = smoothstep(shadowH - 400.0, shadowH + 600.0, alt);
    vec3 sunC = mix(vec3(1.0, 0.32, 0.12), vec3(1.0, 0.82, 0.66), smoothstep(0.0, 18000.0, alt - shadowH));
    float d = distance(wp, uGlowPos);
    float glow = uGlow / (1.0 + pow(d / 110.0, 2.0));
    float flood = uFlood / (1.0 + pow(length(site.xz) / 160.0, 2.0)) * (1.0 - smoothstep(60.0, 400.0, site.y));
    return uAmb + vec3(1.0, 0.5, 0.2) * glow + vec3(0.75, 0.82, 0.95) * flood + sunC * sunlit * uSunCol;
  }`;
