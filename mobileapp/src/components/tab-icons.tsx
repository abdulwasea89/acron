import React from "react";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import type { ColorValue } from "react-native";

/**
 * Bespoke tab-bar glyphs, hand-drawn on a 24×24 grid.
 *
 * Every tab renders in two states that the tab bar cross-fades between:
 *   - `line`   — the resting state: a 1.6px single-weight outline (muted gray)
 *   - `active` — the selected state: an accent-filled silhouette whose interior
 *     detail is drawn as a soft white relief line, so the symbol reads as one
 *     icon thickening rather than a shape swap.
 *
 * The same set is used on iOS, Android and web, so the brand owns the glyphs
 * instead of the platform.
 */

export type TabGlyph =
  | "house"
  | "dumbbell"
  | "credit-card"
  | "person"
  | "clock"
  | "banknote"
  | "receipt"
  | "badge-check"
  | "storefront"
  | "checklist";

const LINE = 1.6;
/** Interior detail of the active/filled silhouette, drawn as white relief. */
const DETAIL = "rgba(255,255,255,0.72)";
const DETAIL_W = 1.4;

interface Glyph {
  line: React.ReactElement;
  active: {
    /** The solid shapes that carry the accent fill. */
    fill: React.ReactElement;
    /** The interior lines that carry the white relief. */
    detail: React.ReactElement;
  };
}

const GLYPHS: Record<TabGlyph, Glyph> = {
  house: {
    line: (
      <G strokeLinecap="round" strokeLinejoin="round">
        <Path d="M4.6 10.4 L12 4.3 L19.4 10.4" />
        <Path d="M6.4 10.4 V18.8 H17.6 V10.4" />
        <Path d="M10.3 18.8 V14.6 H13.7 V18.8" />
      </G>
    ),
    active: {
      fill: <Path d="M4.2 10.7 L12 4.2 L19.8 10.7 L19.8 18.9 L4.2 18.9 Z" />,
      detail: <Path d="M10.4 18.9 V15 H13.6 V18.9" />,
    },
  },

  dumbbell: {
    line: (
      <G strokeLinecap="round" strokeLinejoin="round">
        <Rect x={3.2} y={8.4} width={3.4} height={7.2} rx={1} />
        <Rect x={17.4} y={8.4} width={3.4} height={7.2} rx={1} />
        <Path d="M7 12 H17" />
        <Path d="M11.3 10.5 V13.5" />
        <Path d="M12.9 10.5 V13.5" />
      </G>
    ),
    active: {
      fill: (
        <G>
          <Rect x={3} y={8.2} width={3.9} height={7.6} rx={1.1} />
          <Rect x={17.1} y={8.2} width={3.9} height={7.6} rx={1.1} />
          <Path d="M6.9 11.3 H17.1 V12.7 H6.9 Z" />
        </G>
      ),
      detail: (
        <G>
          <Path d="M11.3 10.6 V13.4" />
          <Path d="M12.9 10.6 V13.4" />
        </G>
      ),
    },
  },

  "credit-card": {
    line: (
      <G strokeLinecap="round" strokeLinejoin="round">
        <Rect x={3.4} y={5.5} width={17.2} height={13} rx={2.6} />
        <Path d="M5.9 9.4 H13.8" />
        <Path d="M15 10.6 C16.5 11.2 16.5 12.8 15 13.4" />
        <Path d="M16.9 9 C19.2 10.2 19.2 13.8 16.9 15" />
      </G>
    ),
    active: {
      fill: <Rect x={3.15} y={5.25} width={17.7} height={13.5} rx={2.75} />,
      detail: (
        <G>
          <Path d="M5.9 9.4 H13.8" />
          <Path d="M15 10.6 C16.5 11.2 16.5 12.8 15 13.4" />
          <Path d="M16.9 9 C19.2 10.2 19.2 13.8 16.9 15" />
        </G>
      ),
    },
  },

  person: {
    line: (
      <G strokeLinecap="round" strokeLinejoin="round">
        <Circle cx={12} cy={8.1} r={3.2} />
        <Path d="M4.9 19.1 C4.9 15.6 8.1 13.8 12 13.8 C15.9 13.8 19.1 15.6 19.1 19.1 V20 H4.9 Z" />
      </G>
    ),
    active: {
      fill: (
        <G>
          <Circle cx={12} cy={8.1} r={3.7} />
          <Path d="M4.6 19.2 C4.6 15.4 8.1 13.6 12 13.6 C15.9 13.6 19.4 15.4 19.4 19.2 V20.2 H4.6 Z" />
        </G>
      ),
      detail: <G />,
    },
  },

  clock: {
    line: (
      <G strokeLinecap="round" strokeLinejoin="round">
        <Circle cx={12} cy={12} r={8} />
        <Path d="M12 7.9 V12" />
        <Path d="M12 12 L15.1 13.5" />
      </G>
    ),
    active: {
      fill: <Circle cx={12} cy={12} r={8.4} />,
      detail: (
        <G>
          <Path d="M12 8.2 V12" />
          <Path d="M12 12.1 L15 13.5" />
        </G>
      ),
    },
  },

  banknote: {
    line: (
      <G strokeLinecap="round" strokeLinejoin="round">
        <Rect x={3.4} y={7} width={17.2} height={10} rx={2} />
        <Circle cx={11.4} cy={12} r={2.7} />
        <Path d="M16.6 9.5 V10.9" />
        <Path d="M18.7 9.5 V10.9" />
      </G>
    ),
    active: {
      fill: <Rect x={3.15} y={6.75} width={17.7} height={10.5} rx={2.15} />,
      detail: (
        <G>
          <Circle cx={11.4} cy={12} r={2.7} />
          <Path d="M16.6 9.5 V10.9" />
          <Path d="M18.7 9.5 V10.9" />
        </G>
      ),
    },
  },

  receipt: {
    line: (
      <G strokeLinecap="round" strokeLinejoin="round">
        <Path d="M5.6 3.8 H18.4 V20.1 L17.2 19.3 L16 20.4 L14.8 19.3 L13.6 20.4 L12.4 19.3 L11.2 20.4 L10 19.3 L8.8 20.4 L7.6 19.3 L6.4 20.4 L5.6 19.5 Z" />
        <Path d="M8.6 8.3 H15.4" />
        <Path d="M8.6 11.3 H12.8" />
        <Path d="M8.6 14.3 H11.2" />
      </G>
    ),
    active: {
      fill: (
        <Path d="M5.3 3.5 H18.7 V20.4 L17.2 19.3 L16 20.4 L14.8 19.3 L13.6 20.4 L12.4 19.3 L11.2 20.4 L10 19.3 L8.8 20.4 L7.6 19.3 L6.4 20.4 L5.3 19.6 Z" />
      ),
      detail: (
        <G>
          <Path d="M8.8 8.6 H15.2" />
          <Path d="M8.8 11.6 H12.7" />
          <Path d="M8.8 14.6 H11.1" />
        </G>
      ),
    },
  },

  "badge-check": {
    line: (
      <G strokeLinecap="round" strokeLinejoin="round">
        <Rect x={4.4} y={4.6} width={15.2} height={14.8} rx={4.4} />
        <Path d="M8.8 12.3 L11.1 14.6 L15.3 9.9" />
      </G>
    ),
    active: {
      fill: <Rect x={4.15} y={4.35} width={15.7} height={15.3} rx={4.6} />,
      detail: <Path d="M8.9 12.3 L11.1 14.5 L15.2 10" />,
    },
  },

  storefront: {
    line: (
      <G strokeLinecap="round" strokeLinejoin="round">
        <Path d="M4.6 6.4 H19.4" />
        <Path d="M5.6 10 V18.8 H18.4 V10" />
        <Path d="M10.8 18.8 V13.6 H13.2 V18.8" />
        <Path d="M7.2 12.9 V16.4" />
        <Path d="M16.8 12.9 V16.4" />
      </G>
    ),
    active: {
      fill: (
        <G>
          <Rect x={4.35} y={5.9} width={15.3} height={1.2} rx={0.6} />
          <Path d="M5.35 9.7 V19.05 H18.65 V9.7 Z" />
        </G>
      ),
      detail: (
        <G>
          <Path d="M10.8 19.05 V13.8 H13.2 V19.05" />
          <Path d="M7.2 13.1 V16.2" />
          <Path d="M16.8 13.1 V16.2" />
        </G>
      ),
    },
  },

  checklist: {
    line: (
      <G strokeLinecap="round" strokeLinejoin="round">
        <Rect x={4} y={3.6} width={16} height={16.8} rx={2.6} />
        <Path d="M7.6 7 H11.6" />
        <Path d="M8.3 10.9 L10 12.6 L13.9 8.9" />
        <Path d="M8.3 15.4 L10 17.1 L13.9 13.4" />
      </G>
    ),
    active: {
      fill: <Rect x={3.75} y={3.35} width={16.5} height={17.3} rx={2.75} />,
      detail: (
        <G>
          <Path d="M7.7 7.2 H11.5" />
          <Path d="M8.4 10.9 L10.1 12.6 L14 8.9" />
          <Path d="M8.4 15.4 L10.1 17.1 L14 13.4" />
        </G>
      ),
    },
  },
};

interface TabGlyphIconProps {
  name: TabGlyph;
  /** `false` renders the resting outline, `true` the accent-filled silhouette. */
  active: boolean;
  size: number;
  color: ColorValue;
}

export function TabGlyphIcon({ name, active, size, color }: TabGlyphIconProps) {
  const glyph = GLYPHS[name];

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {active ? (
        <>
          <G fill={color}>{glyph.active.fill}</G>
          <G
            fill="none"
            stroke={DETAIL}
            strokeWidth={DETAIL_W}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {glyph.active.detail}
          </G>
        </>
      ) : (
        <G fill="none" stroke={color} strokeWidth={LINE} strokeLinecap="round" strokeLinejoin="round">
          {glyph.line}
        </G>
      )}
    </Svg>
  );
}

