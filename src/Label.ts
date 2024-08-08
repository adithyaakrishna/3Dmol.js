import {
  SpriteAlignment,
  Texture,
  SpriteMaterial,
  Sprite,
  Vector2,
  Material,
} from "./WebGL";
import { Gradient } from "./Gradient";
import { Color, CC, ColorSpec } from "./colors";
import {XYZ} from "./WebGL/math"

// Adapted from the text sprite example from http://stemkoski.github.io/Three.js/index.html

export let LabelCount = 0;

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  drawBorder: boolean
): void => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  if (drawBorder) ctx.stroke();
};

const getColor = (style: any, stylealpha?: number, init?: RGBA): RGBA => {
  let ret = init ?? { r: 255, g: 255, b: 255, a: 1.0 };

  if (style) {
    if (style instanceof Color) {
      const scaled = style.scaled();
      ret = { r: scaled.r, g: scaled.g, b: scaled.b, a: 1.0 };
    } else {
      let color = CC.color(style);
      if (typeof (color as any).scaled !== "undefined") {
        const scaled = (color as any).scaled();
        ret = { r: scaled.r, g: scaled.g, b: scaled.b, a: scaled.a ?? 1.0 };
      } else {
        ret = { r: color.r, g: color.g, b: color.b, a: (color as any).a ?? 1.0 };
      }
    }
  }

  if (stylealpha !== undefined) {
    ret.a = parseFloat(stylealpha.toString());
  }

  return ret;
};

export interface LabelSpec {
  font?: string;
  fontSize?: number;
  fontColor?: ColorSpec;
  fontOpacity?: number;
  borderThickness?: number;
  borderColor?: ColorSpec;
  borderOpacity?: number;
  backgroundColor?: ColorSpec;
  backgroundOpacity?: number;
  position?: XYZ;
  screenOffset?: Vector2;
  inFront?: boolean;
  showBackground?: boolean;
  useScreen?: boolean;
  backgroundImage?: CanvasImageSource;
  alignment?: string | Vector2;
  frame?: number;
  padding?: number;
  bold?: boolean;
  backgroundGradient?: any;
  backgroundWidth?: number;
  backgroundHeight?: number;
}

export class Label {
  private readonly stylespec: LabelSpec;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  public readonly sprite: Sprite;
  private readonly text: string;
  public readonly frame: number | undefined;

  constructor(text: string, parameters: LabelSpec = {}) {
    LabelCount++;
    this.stylespec = parameters;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 134;
    this.canvas.height = 35;
    this.context = this.canvas.getContext("2d")!;
    this.sprite = new Sprite();
    this.text = text;
    this.frame = this.stylespec.frame;
  }

  public getStyle(): LabelSpec {
    return this.stylespec;
  }

  public setContext(): void {
    const {
      useScreen = false,
      showBackground = true,
      font = "sans-serif",
      fontSize = 18,
      fontColor,
      fontOpacity,
      padding = 4,
      borderThickness = 0,
      backgroundColor,
      backgroundOpacity,
      borderColor,
      borderOpacity,
      position = { x: -10, y: 1, z: 1 },
      inFront = true,
      alignment = SpriteAlignment.topLeft,
      bold = false,
      backgroundImage,
      backgroundWidth,
      backgroundHeight,
      backgroundGradient,
    } = this.stylespec;

    const fontColorRGBA = getColor(fontColor, fontOpacity);
    const backgroundColorRGBA = getColor(backgroundColor, backgroundOpacity, {
      r: 0,
      g: 0,
      b: 0,
      a: 1.0,
    });
    const borderColorRGBA = getColor(
      borderColor,
      borderOpacity,
      backgroundColorRGBA
    );

    this.context.font = `${bold ? "bold " : ""}${fontSize}px ${font}`;

    const metrics = this.context.measureText(this.text);
    const textWidth = metrics.width;

    const actualBorderThickness = showBackground ? borderThickness : 0;
    let width = textWidth + 2.5 * actualBorderThickness + 2 * padding;
    let height = fontSize * 1.25 + 2 * actualBorderThickness + 2 * padding;

    if (backgroundImage) {
      const w = backgroundWidth ?? (backgroundImage as HTMLImageElement).width;
      const h = backgroundHeight ?? (backgroundImage as HTMLImageElement).height;
      width = Math.max(width, w);
      height = Math.max(height, h);
    }

    this.canvas.width = width;
    this.canvas.height = height;
    this.context.clearRect(0, 0, width, height);

    this.context.font = `${bold ? "bold " : ""}${fontSize}px ${font}`;

    if (backgroundGradient) {
      const gradient = this.context.createLinearGradient(0, height / 2, width, height / 2);
      const g = Gradient.getGradient(backgroundGradient);
      const [min, max] = g.range() ?? [-1, 1];
      const d = max - min;
      for (let i = 0; i <= 1; i += 0.1) {
        const c = getColor(g.valueToHex(min + d * i));
        gradient.addColorStop(i, `rgba(${c.r},${c.g},${c.b},${c.a})`);
      }
      this.context.fillStyle = gradient;
    } else {
      this.context.fillStyle = `rgba(${backgroundColorRGBA.r},${backgroundColorRGBA.g},${backgroundColorRGBA.b},${backgroundColorRGBA.a})`;
    }

    this.context.strokeStyle = `rgba(${borderColorRGBA.r},${borderColorRGBA.g},${borderColorRGBA.b},${borderColorRGBA.a})`;
    this.context.lineWidth = actualBorderThickness;

    if (showBackground) {
      roundRect(
        this.context,
        actualBorderThickness,
        actualBorderThickness,
        width - 2 * actualBorderThickness,
        height - 2 * actualBorderThickness,
        6,
        actualBorderThickness > 0
      );
    }

    if (backgroundImage) {
      this.context.drawImage(backgroundImage, 0, 0, width, height);
    }

    this.context.fillStyle = `rgba(${fontColorRGBA.r},${fontColorRGBA.g},${fontColorRGBA.b},${fontColorRGBA.a})`;
    this.context.fillText(
      this.text,
      actualBorderThickness + padding,
      fontSize + actualBorderThickness + padding,
      textWidth
    );

    const texture = new Texture(this.canvas);
    texture.needsUpdate = true;

    this.sprite.material = new SpriteMaterial({
      map: texture,
      useScreenCoordinates: useScreen,
      alignment: typeof alignment === 'string' ? (SpriteAlignment as any)[alignment] : alignment,
      depthTest: !inFront,
      screenOffset: this.stylespec.screenOffset ?? null,
    }) as unknown as Material;

    this.sprite.scale.set(1, 1, 1);
    this.sprite.position.set(position.x, position.y, position.z);
  }

  public dispose(): void {
    if ((this.sprite.material as SpriteMaterial).map) {
      (this.sprite.material as SpriteMaterial).map.dispose();
    }
    this.sprite.material.dispose();
  }
}
