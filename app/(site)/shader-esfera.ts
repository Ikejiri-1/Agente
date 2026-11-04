/**
 * O shader da esfera de vidro do agente, compartilhado pelo agente grande do login e pelas esferas secundárias do site.
 * Uma fonte de luz (o núcleo dourado por dentro) e um acento (azul elétrico). Camadas, de trás para a frente:
 *   anéis atrás da esfera -> corpo de vidro com filamentos neurais (volume) -> reflexo com Fresnel iridescente
 *   -> anéis na frente -> partículas e halo -> mapeamento de tons e grão.
 */

const VERTICE = `attribute vec2 posicao; void main() { gl_Position = vec4(posicao, 0.0, 1.0); }`;

const FRAGMENTO = `
precision highp float;
uniform vec2 resolucao;
uniform float tempo;
uniform vec2 mouse;
uniform float nascimento;
uniform float passos;     /* passos do volume interior (mais = mais detalhe e mais custo) */
uniform float particulas; /* quantas partículas à deriva */
uniform float aneis;      /* 0 a 1: intensidade dos anéis */
uniform float aquecer;    /* 0 a 1: leva o ciano para o dourado (plano em destaque) */
uniform float calmaria;   /* 0 a 1: atenua o interior (para ler texto por cima) */
uniform float fio;        /* multiplica a espessura dos fios (esferas pequenas precisam de linhas mais grossas) */

const float RAIO = 0.80;
const float PI2 = 6.2831853;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1); p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float ruido(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float soma = 0.0, amplitude = 0.5;
  for (int i = 0; i < 3; i++) { soma += amplitude * ruido(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); amplitude *= 0.5; }
  return soma;
}
float hash1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }

mat3 girarX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 girarY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 girarZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }

/* Por dentro do vidro: caminha pelo raio e soma filamentos finos, nós de luz e o núcleo quente. */
vec3 interior(vec2 p, float raio, float z0, mat3 rot, float t) {
  vec3 soma = vec3(0.0);
  float total = max(passos, 1.0);
  float passo = 2.0 * z0 / raio / total;
  vec3 corDoFilamento = mix(vec3(0.15, 0.6, 1.0), vec3(1.0, 0.62, 0.22), aquecer * 0.75);
  for (int i = 0; i < 22; i++) {
    if (float(i) >= total) break;
    float z = mix(z0, -z0, (float(i) + 0.5) / total);
    vec3 q = rot * (vec3(p, z) / raio);
    float onda = fbm(q * 1.8 + vec3(0.0, t * 0.12, 0.0));
    float crista = 1.0 - abs(2.0 * ruido(q * 2.7 + onda * 2.3 + t * 0.05) - 1.0);
    float filamento = pow(crista, 15.0);
    float nos = pow(ruido(q * 7.0 + t * 0.1), 20.0) * 30.0;
    float r = length(q);
    float nucleo = exp(-r * r * 8.0);
    float casca = smoothstep(0.35, 1.0, r);
    vec3 cor = filamento * mix(corDoFilamento, vec3(0.85, 0.97, 1.0), filamento) * (1.1 + 1.8 * casca)
             + nos * vec3(1.0, 0.82, 0.5) * 0.7
             + nucleo * vec3(1.0, 0.55, 0.14) * 2.7
             + vec3(0.01, 0.06, 0.32) * (0.5 + onda);
    soma += cor * passo;
  }
  return soma;
}

/* Um anel inclinado no espaço: devolve (distância ao raio, ângulo, profundidade) do ponto da tela no plano do anel. */
vec3 planoDoAnel(vec2 p, mat3 M) {
  vec3 N = M * vec3(0.0, 0.0, 1.0), U = M * vec3(1.0, 0.0, 0.0), V = M * vec3(0.0, 1.0, 0.0);
  float z = -(N.x * p.x + N.y * p.y) / N.z;
  vec3 X = vec3(p, z);
  vec2 a = vec2(dot(X, U), dot(X, V));
  return vec3(length(a), atan(a.y, a.x) / PI2, z);
}

vec3 umAnel(vec2 p, mat3 M, float raio, float largura, float marcas, float velocidade, float cometa, vec3 cor, float t) {
  largura *= fio;
  vec3 a = planoDoAnel(p, M);
  float d = a.x - raio;
  float linha = exp(-d * d / (largura * largura));
  float brilho = exp(-d * d / (largura * largura * 40.0)) * 0.1;
  float marca = marcas > 0.0 ? smoothstep(0.38, 0.5, abs(fract(a.y * marcas) - 0.5)) : 1.0;
  float cabeca = pow(fract(a.y - t * velocidade), 12.0) * cometa;
  float atras = (a.z < 0.0 && length(p) < RAIO) ? 0.3 : 1.0;
  float fundo = 0.55 + 0.45 * smoothstep(-1.2, 1.2, a.z);
  return cor * (linha * (0.35 + 0.65 * marca + cabeca * 3.5) + brilho) * atras * fundo;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * resolucao) / (0.5 * resolucao.y) * 1.35;
  float t = tempo;
  float nasc = 1.0 - pow(1.0 - clamp(nascimento, 0.0, 1.0), 3.0);
  float raio = RAIO * mix(0.35, 1.0, nasc);
  mat3 rot = girarY(t * 0.18 + mouse.x * 0.9) * girarX(0.35 - mouse.y * 0.7);
  vec3 cor = vec3(0.0);

  /* anéis: dois de ciano, um dourado com cometa, um tênue e largo; o conjunto balança com o ponteiro */
  mat3 inclinar = girarX(-mouse.y * 0.18) * girarY(mouse.x * 0.18);
  float girar = t * 0.12;
  if (aneis > 0.01) {
    vec3 ciano = mix(vec3(0.45, 0.85, 1.0), vec3(1.0, 0.8, 0.45), aquecer * 0.7);
    cor += umAnel(p, inclinar * girarZ(girar) * girarX(1.18), 1.20, 0.012, 72.0, 0.05, 1.0, ciano, t) * aneis;
    cor += umAnel(p, inclinar * girarZ(-girar * 1.3 + 1.0) * girarX(-0.95) * girarY(0.4), 1.02, 0.014, 0.0, -0.08, 1.0, vec3(1.0, 0.78, 0.38), t) * 0.9 * aneis;
    cor += umAnel(p, inclinar * girarZ(girar * 0.6 + 2.0) * girarX(1.35), 1.29, 0.008, 140.0, 0.0, 0.0, vec3(0.35, 0.65, 1.0), t) * 0.55 * aneis;
  }

  float r2 = dot(p, p);
  float distancia = length(p) - raio;

  if (r2 < raio * raio) {
    float z0 = sqrt(raio * raio - r2);
    vec3 n = vec3(p, z0) / raio;
    float fresnel = pow(1.0 - n.z, 2.6);

    vec3 vidro = interior(p, raio, z0, rot, t) * calmaria;
    vidro *= 1.0 - 0.35 * fresnel;

    vec3 iridescencia = 0.5 + 0.5 * cos(PI2 * (vec3(0.0, 0.33, 0.67) + n.y * 0.45 + n.x * 0.2 + t * 0.03));
    vec3 borda = mix(mix(vec3(0.3, 0.8, 1.0), vec3(1.0, 0.75, 0.35), aquecer * 0.6), iridescencia, 0.4);
    vec3 luz = normalize(vec3(-0.5, 0.65, 0.6));
    float brilho = pow(max(dot(n, normalize(luz + vec3(0.0, 0.0, 1.0))), 0.0), 110.0) * 2.4;
    vec3 refletido = reflect(vec3(0.0, 0.0, -1.0), n);
    float caixaDeLuz = smoothstep(0.55, 0.92, refletido.y) * smoothstep(-0.3, 0.5, -refletido.x);
    float faixa = smoothstep(0.1, 0.0, abs(refletido.x - 0.55 - 0.1 * sin(refletido.y * 6.0))) * smoothstep(-0.2, 0.4, refletido.y);
    float ouroDeBaixo = smoothstep(0.1, -0.9, n.y) * fresnel;

    cor += vidro;
    cor += borda * fresnel * 1.3;
    cor += vec3(0.65, 0.85, 1.0) * (caixaDeLuz * 0.4 + faixa * 0.18) * (0.2 + fresnel);
    cor += vec3(1.0, 0.72, 0.35) * ouroDeBaixo * 0.9;
    cor += brilho;
    /* um fio de borda bem fino e claro, como a aresta de uma bolha de vidro */
    cor += vec3(0.7, 0.95, 1.0) * smoothstep(0.012 * fio, 0.0, abs(distancia)) * 0.9;
    cor *= mix(1.0, 0.55 + 0.45 * smoothstep(0.0, 0.5, nasc), 1.0 - nasc);
  } else {
    /* halo: pico curto e cauda longa, com uma pontinha de dourado perto da esfera */
    float d = max(distancia, 0.0);
    float esmaecer = 1.0 - smoothstep(0.7, 1.3, length(p)); /* o halo morre antes da borda do canvas: sem retângulo */
    cor += (vec3(0.18, 0.55, 1.0) * exp(-d * 5.0) * 0.5 + vec3(0.1, 0.32, 0.9) * exp(-d * 2.6) * 0.22 + vec3(1.0, 0.7, 0.3) * exp(-d * 16.0) * 0.18) * esmaecer;
  }

  /* partículas à deriva */
  for (int i = 0; i < 26; i++) {
    if (float(i) >= particulas) break;
    float k = float(i);
    float a = hash1(k + 1.0) * PI2 + t * (0.05 + 0.1 * hash1(k + 7.0)) * (hash1(k + 3.0) > 0.5 ? 1.0 : -1.0);
    float rr = 0.85 + 0.5 * hash1(k + 11.0) + 0.04 * sin(t * 0.7 + k);
    vec2 pos = vec2(cos(a), sin(a) * (0.55 + 0.4 * hash1(k + 5.0))) * rr;
    float d2 = dot(p - pos, p - pos);
    float pisca = 0.6 + 0.4 * sin(t * 1.7 + k * 3.0);
    vec3 corDaParticula = hash1(k + 19.0) < 0.3 ? vec3(1.0, 0.8, 0.45) : vec3(0.6, 0.9, 1.0);
    cor += corDaParticula * (0.00018 / (d2 + 0.00025)) * pisca * (0.6 + 0.8 * hash1(k + 23.0));
  }

  /* nascimento: um clarão no núcleo logo que a esfera acende */
  cor += vec3(1.0, 0.85, 0.6) * exp(-dot(p, p) * 9.0) * (1.0 - nasc) * 2.0;

  /* mapeamento de tons e grão (a saída é luz somada sobre o fundo: o alfa acompanha o brilho) */
  cor = vec3(1.0) - exp(-cor * 0.95);
  cor = pow(cor, vec3(0.92));
  float grao = (hash(vec3(gl_FragCoord.xy, floor(t * 24.0))) - 0.5) * 0.035;
  float alfa = clamp(max(cor.r, max(cor.g, cor.b)), 0.0, 1.0);
  cor += grao * alfa;
  gl_FragColor = vec4(cor, alfa);
}
`;

/** Tudo o que muda de uma esfera para outra. */
export type OpcoesDaEsfera = {
  largura: number;
  altura: number;
  tempo: number;
  mouse: [number, number];
  nascimento: number;
  passos: number;
  particulas: number;
  aneis: number;
  aquecer: number;
  calmaria: number;
  fio: number;
};

function compilar(gl: WebGLRenderingContext, tipo: number, fonte: string) {
  const shader = gl.createShader(tipo)!;
  gl.shaderSource(shader, fonte);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

/** Monta o programa no contexto e devolve a função que desenha uma esfera no canvas dele; null se o WebGL falhar. */
export function criarPassadaDaEsfera(gl: WebGLRenderingContext): ((opcoes: OpcoesDaEsfera) => void) | null {
  const vertice = compilar(gl, gl.VERTEX_SHADER, VERTICE);
  const fragmento = compilar(gl, gl.FRAGMENT_SHADER, FRAGMENTO);
  if (!vertice || !fragmento) return null;
  const programa = gl.createProgram()!;
  gl.attachShader(programa, vertice);
  gl.attachShader(programa, fragmento);
  gl.linkProgram(programa);
  if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) return null;
  gl.useProgram(programa);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const posicao = gl.getAttribLocation(programa, "posicao");
  gl.enableVertexAttribArray(posicao);
  gl.vertexAttribPointer(posicao, 2, gl.FLOAT, false, 0, 0);
  const uniforme = (nome: string) => gl.getUniformLocation(programa, nome);
  const u = {
    resolucao: uniforme("resolucao"), tempo: uniforme("tempo"), mouse: uniforme("mouse"), nascimento: uniforme("nascimento"), passos: uniforme("passos"),
    particulas: uniforme("particulas"), aneis: uniforme("aneis"), aquecer: uniforme("aquecer"), calmaria: uniforme("calmaria"), fio: uniforme("fio"),
  };

  return (opcoes) => {
    gl.viewport(0, 0, opcoes.largura, opcoes.altura);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(u.resolucao, opcoes.largura, opcoes.altura);
    gl.uniform1f(u.tempo, opcoes.tempo);
    gl.uniform2f(u.mouse, opcoes.mouse[0], opcoes.mouse[1]);
    gl.uniform1f(u.nascimento, opcoes.nascimento);
    gl.uniform1f(u.passos, opcoes.passos);
    gl.uniform1f(u.particulas, opcoes.particulas);
    gl.uniform1f(u.aneis, opcoes.aneis);
    gl.uniform1f(u.aquecer, opcoes.aquecer);
    gl.uniform1f(u.calmaria, opcoes.calmaria);
    gl.uniform1f(u.fio, opcoes.fio);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}
