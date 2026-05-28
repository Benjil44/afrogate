const MIN_TEXT_CONTRAST = 4.5;

const contrastPairs = [
  {
    background: '#101820',
    foreground: '#fecaca',
    minimum: MIN_TEXT_CONTRAST,
    name: 'sidebar critical alert nav inactive',
  },
  {
    background: '#4a1118',
    foreground: '#ffffff',
    minimum: MIN_TEXT_CONTRAST,
    name: 'sidebar critical alert nav active',
  },
  {
    background: '#3b1014',
    foreground: '#ffffff',
    minimum: MIN_TEXT_CONTRAST,
    name: 'sidebar critical alert nav hover',
  },
  {
    background: '#101820',
    foreground: '#f4d7a1',
    minimum: MIN_TEXT_CONTRAST,
    name: 'sidebar warning alert nav inactive',
  },
  {
    background: '#3c2a12',
    foreground: '#ffffff',
    minimum: MIN_TEXT_CONTRAST,
    name: 'sidebar warning alert nav active',
  },
  {
    background: '#3c2a12',
    foreground: '#ffffff',
    minimum: MIN_TEXT_CONTRAST,
    name: 'sidebar warning alert nav hover',
  },
  {
    background: '#dc2626',
    foreground: '#ffffff',
    minimum: MIN_TEXT_CONTRAST,
    name: 'sidebar critical alert count badge',
  },
  {
    background: '#f5b84b',
    foreground: '#20160a',
    minimum: MIN_TEXT_CONTRAST,
    name: 'sidebar warning alert count badge',
  },
  {
    background: '#fff1f1',
    foreground: '#b91c1c',
    minimum: MIN_TEXT_CONTRAST,
    name: 'light critical status badge',
  },
  {
    background: '#fff7e6',
    foreground: '#9a5b00',
    minimum: MIN_TEXT_CONTRAST,
    name: 'light warning status badge',
  },
];

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');

  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  return [0, 2, 4].map((index) => parseInt(normalized.slice(index, index + 2), 16));
}

function relativeLuminance(hex) {
  const [red, green, blue] = hexToRgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));

  return (lighter + 0.05) / (darker + 0.05);
}

const failures = contrastPairs
  .map((pair) => ({
    ...pair,
    ratio: contrastRatio(pair.foreground, pair.background),
  }))
  .filter((pair) => pair.ratio < pair.minimum);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(
      `${failure.name}: ${failure.ratio.toFixed(2)} contrast is below ${failure.minimum.toFixed(1)} for ${failure.foreground} on ${failure.background}`,
    );
  }

  process.exitCode = 1;
} else {
  console.log(`Dashboard contrast check passed: ${contrastPairs.length} warning/critical pairs meet AA text contrast.`);
}
