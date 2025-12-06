import React, { useMemo } from 'react';
import { Text, View, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import Katex from 'react-native-katex';

interface MathTextProps {
  children: string;
  style?: TextStyle;
  mathStyle?: ViewStyle;
}

/**
 * MathText component that renders text with inline LaTeX math expressions.
 * Math expressions should be wrapped in $...$ delimiters.
 * Example: "The formula $x^2 + y^2 = r^2$ represents a circle."
 */
export function MathText({ children, style, mathStyle }: MathTextProps) {
  // Parse text and split into regular text and math expressions
  const parts = useMemo(() => {
    if (!children || typeof children !== 'string') return [];

    // Match $...$ patterns (non-greedy)
    const regex = /(\$[^$]+\$)/g;
    const segments = children.split(regex);

    return segments.filter(s => s.length > 0).map((segment, index) => {
      if (segment.startsWith('$') && segment.endsWith('$')) {
        return {
          type: 'math' as const,
          content: segment.slice(1, -1),
          key: `math-${index}`,
        };
      }
      return {
        type: 'text' as const,
        content: segment,
        key: `text-${index}`,
      };
    });
  }, [children]);

  // If no math expressions, just render as regular text
  const hasMath = parts.some(p => p.type === 'math');
  if (!hasMath) {
    return <Text style={style}>{children}</Text>;
  }

  return (
    <View style={styles.container}>
      {parts.map(part => {
        if (part.type === 'math') {
          return (
            <View key={part.key} style={[styles.mathContainer, mathStyle]}>
              <Katex
                expression={part.content}
                style={styles.katex}
                inlineStyle={`
                  html, body {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0;
                    padding: 0;
                    background-color: transparent;
                  }
                  .katex {
                    font-size: 1.1em;
                  }
                `}
                throwOnError={false}
              />
            </View>
          );
        }
        return (
          <Text key={part.key} style={style}>
            {part.content}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  mathContainer: {
    minHeight: 24,
    justifyContent: 'center',
  },
  katex: {
    minHeight: 24,
    backgroundColor: 'transparent',
  },
});
