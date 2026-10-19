import React, { useId } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';

// Vector geometry copied from logos/final/svg (lumyo-mark.svg and
// lumyo-wordmark.svg) so the app renders the exact brand files. The gradient
// is reserved for the mark; the wordmark takes the current text color.

const MARK_W = 342;
const MARK_H = 401;
const WORD_VIEWBOX = '5 -304 1151 408';
const WORD_RATIO = 1151 / 408;
const WORD_PATH =
  'M29.3 0V-280H75V0ZM201.1 3.3Q178.3 3.3 160.9 -6.9Q143.4 -17.2 133.6 -35.9Q123.8 -54.5 123.8 -79.3V-197.7H169.6V-82.9Q169.6 -58.9 181.5 -47.1Q193.4 -35.4 214.9 -35.4Q239.3 -35.4 253.3 -51.6Q267.4 -67.8 267.4 -97.5V-197.7H313.2V0H268.2V-27.7H261.4Q256.2 -16.8 242.4 -6.7Q228.7 3.3 201.1 3.3ZM363.7 0V-197.7H408.6V-175.4H415.4Q420.8 -185.5 433 -193.3Q445.2 -201 465.6 -201Q487.2 -201 500.4 -192.4Q513.5 -183.7 520.2 -170.2H527Q533.8 -183.4 546.5 -192.2Q559.3 -201 582.6 -201Q601.3 -201 616.3 -193.2Q631.3 -185.3 640.1 -169.7Q649 -154.1 649 -130.9V0H603.3V-127.5Q603.3 -144.7 594.1 -153.6Q585 -162.6 568.5 -162.6Q550.2 -162.6 539.7 -150.9Q529.2 -139.2 529.2 -117.3V0H483.5V-127.5Q483.5 -144.7 474.3 -153.6Q465.2 -162.6 448.7 -162.6Q430.4 -162.6 419.9 -150.9Q409.4 -139.2 409.4 -117.3V0ZM719.7 80V39.9H828.7Q840.1 39.9 840.1 27.9V-27.3H833.3Q829.8 -20 822.7 -12.9Q815.6 -5.8 803.6 -1.2Q791.6 3.3 773.1 3.3Q750.3 3.3 732.9 -6.9Q715.4 -17.2 705.6 -35.8Q695.8 -54.4 695.8 -79.2V-197.7H741.6V-82.8Q741.6 -58.8 753.5 -47.1Q765.4 -35.4 786.9 -35.4Q811.3 -35.4 825.3 -51.6Q839.4 -67.7 839.4 -97.5V-197.7H885.2V37.7Q885.2 57.1 873.9 68.5Q862.7 80 843.4 80ZM1029.1 5.6Q999.5 5.6 976.1 -6.5Q952.8 -18.6 939.4 -41.4Q926.1 -64.1 926.1 -95.8V-101.9Q926.1 -133.6 939.4 -156.3Q952.8 -179.1 976.1 -191.2Q999.5 -203.3 1029.1 -203.3Q1058.7 -203.3 1082 -191.2Q1105.4 -179.1 1118.7 -156.3Q1132.1 -133.6 1132.1 -101.9V-95.8Q1132.1 -64.1 1118.7 -41.4Q1105.4 -18.6 1082 -6.5Q1058.7 5.6 1029.1 5.6ZM1029.1 -35.1Q1054.2 -35.1 1070.3 -51.3Q1086.3 -67.5 1086.3 -96.9V-100.8Q1086.3 -130.2 1070.4 -146.4Q1054.6 -162.6 1029.1 -162.6Q1004 -162.6 987.9 -146.4Q971.8 -130.2 971.8 -100.8V-96.9Q971.8 -67.5 987.9 -51.3Q1004 -35.1 1029.1 -35.1Z';

function MarkShapes({ paint, spark }: { paint: string; spark: string }) {
  return (
    <>
      <G fill="none" stroke={paint} strokeWidth={54}>
        <Path d="M107.5 214V68" strokeLinecap="round" />
        <Path d="M107.5 68A40 40 0 0 0 27.5 68V262C27.5 330 75 372.5 140 372.5H174" />
      </G>
      <Path
        d="M139 212L240 70M139 212H296M139 212L240 354"
        fill="none" stroke={paint} strokeWidth={28} strokeLinecap="round"
      />
      <G fill={paint}>
        <Circle cx={139} cy={212} r={56} />
        <Circle cx={240} cy={70} r={45} />
        <Circle cx={296} cy={212} r={45.5} />
        <Circle cx={240} cy={354} r={45.5} />
      </G>
      <Path d="M137 179Q141 208 171 212Q141 216 137 245Q133 216 103 212Q133 208 137 179Z" fill={spark} />
    </>
  );
}

interface MarkProps {
  size?: number;
  /** Solid fill instead of the brand gradient, e.g. white on a violet tile. */
  color?: string;
}

/** The Lumyo L with three spokes and the spark, scaled by height. */
// SVG ids are document-global on web: two marks sharing one gradient id make
// the second render blank once the first sits on a hidden screen.
function useGradientId(prefix: string) {
  return prefix + useId().replace(/[^a-zA-Z0-9]/g, '');
}

export function LogoMark({ size = 32, color }: MarkProps) {
  const gradientId = useGradientId('lumyoMark');
  const paint = color ?? `url(#${gradientId})`;
  return (
    <Svg width={(size * MARK_W) / MARK_H} height={size} viewBox={`0 0 ${MARK_W} ${MARK_H}`}>
      {!color && (
        <Defs>
          <LinearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={MARK_W} y2={MARK_H}>
            <Stop offset="0" stopColor="#8D4EF7" />
            <Stop offset="1" stopColor="#6827CD" />
          </LinearGradient>
        </Defs>
      )}
      <MarkShapes paint={paint} spark={color ? 'transparent' : '#BCA3FE'} />
    </Svg>
  );
}

interface WordmarkProps {
  height?: number;
  color?: string;
}

/** "lumyo" set in the brand's outlined letterforms. */
export function Wordmark({ height = 24, color }: WordmarkProps) {
  const { colors } = useTheme();
  return (
    <Svg width={height * WORD_RATIO} height={height} viewBox={WORD_VIEWBOX}>
      <Path d={WORD_PATH} fill={color ?? colors.textPrimary} />
    </Svg>
  );
}

// Wordmark as positioned in the horizontal lockup (lumyo-logo.svg).
const LOCKUP_VIEWBOX = '-24 -24 1602 468';
const LOCKUP_RATIO = 1602 / 468;
const LOCKUP_WORD_PATH =
  'M451.3 340.5V60.5H497V340.5ZM623.1 343.8Q600.3 343.8 582.9 333.6Q565.4 323.3 555.6 304.6Q545.8 286 545.8 261.2V142.8H591.6V257.6Q591.6 281.6 603.5 293.4Q615.4 305.1 636.9 305.1Q661.3 305.1 675.3 288.9Q689.4 272.7 689.4 243V142.8H735.2V340.5H690.2V312.8H683.4Q678.2 323.7 664.4 333.8Q650.7 343.8 623.1 343.8ZM785.7 340.5V142.8H830.6V165.1H837.4Q842.8 155 855 147.2Q867.2 139.5 887.6 139.5Q909.2 139.5 922.4 148.1Q935.5 156.8 942.2 170.3H949Q955.8 157.1 968.5 148.3Q981.3 139.5 1004.6 139.5Q1023.3 139.5 1038.3 147.3Q1053.3 155.2 1062.1 170.8Q1071 186.4 1071 209.6V340.5H1025.3V213Q1025.3 195.8 1016.1 186.9Q1007 177.9 990.5 177.9Q972.2 177.9 961.7 189.6Q951.2 201.3 951.2 223.2V340.5H905.5V213Q905.5 195.8 896.3 186.9Q887.2 177.9 870.7 177.9Q852.4 177.9 841.9 189.6Q831.4 201.3 831.4 223.2V340.5ZM1141.7 420.5V380.4H1250.7Q1262.1 380.4 1262.1 368.4V313.2H1255.3Q1251.8 320.5 1244.7 327.6Q1237.6 334.7 1225.6 339.3Q1213.6 343.8 1195.1 343.8Q1172.3 343.8 1154.9 333.6Q1137.4 323.3 1127.6 304.7Q1117.8 286.1 1117.8 261.3V142.8H1163.6V257.7Q1163.6 281.7 1175.5 293.4Q1187.4 305.1 1208.9 305.1Q1233.3 305.1 1247.3 288.9Q1261.4 272.8 1261.4 243V142.8H1307.2V378.2Q1307.2 397.6 1295.9 409Q1284.7 420.5 1265.4 420.5ZM1451.1 346.1Q1421.5 346.1 1398.1 334Q1374.8 321.9 1361.4 299.1Q1348.1 276.4 1348.1 244.7V238.6Q1348.1 206.9 1361.4 184.2Q1374.8 161.4 1398.1 149.3Q1421.5 137.2 1451.1 137.2Q1480.7 137.2 1504 149.3Q1527.4 161.4 1540.7 184.2Q1554.1 206.9 1554.1 238.6V244.7Q1554.1 276.4 1540.7 299.1Q1527.4 321.9 1504 334Q1480.7 346.1 1451.1 346.1ZM1451.1 305.4Q1476.2 305.4 1492.3 289.2Q1508.3 273 1508.3 243.6V239.7Q1508.3 210.3 1492.4 194.1Q1476.6 177.9 1451.1 177.9Q1426 177.9 1409.9 194.1Q1393.8 210.3 1393.8 239.7V243.6Q1393.8 273 1409.9 289.2Q1426 305.4 1451.1 305.4Z';

interface LogoProps {
  /** Height of the whole lockup, including the file's built-in padding. */
  height?: number;
  style?: StyleProp<ViewStyle>;
}

/** Horizontal lockup: mark and wordmark, exactly as lumyo-logo.svg. */
export function Logo({ height = 32, style }: LogoProps) {
  const { colors } = useTheme();
  const gradientId = useGradientId('lumyoLockup');
  return (
    <View style={style} accessible accessibilityRole="image" accessibilityLabel="Lumyo">
      <Svg width={height * LOCKUP_RATIO} height={height} viewBox={LOCKUP_VIEWBOX}>
        <Defs>
          <LinearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={MARK_W} y2={MARK_H}>
            <Stop offset="0" stopColor="#8D4EF7" />
            <Stop offset="1" stopColor="#6827CD" />
          </LinearGradient>
        </Defs>
        <MarkShapes paint={`url(#${gradientId})`} spark="#BCA3FE" />
        <Path d={LOCKUP_WORD_PATH} fill={colors.textPrimary} />
      </Svg>
    </View>
  );
}
