import React from 'react';
import { Text, TextStyle } from 'react-native';

interface MathTextProps {
  children: string;
  style?: TextStyle;
}

/**
 * MathText component - renders text and displays LaTeX expressions inline.
 * For now, LaTeX is shown as-is since react-native-katex has WebView sizing issues.
 * Math expressions wrapped in $...$ are displayed as formatted text.
 */
export function MathText({ children, style }: MathTextProps) {
  if (!children || typeof children !== 'string') {
    return <Text style={style}>{children}</Text>;
  }

  // For now, just render as regular text
  // LaTeX expressions will show as $formula$ which is still readable
  return <Text style={style}>{children}</Text>;
}
