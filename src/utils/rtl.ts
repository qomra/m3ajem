/**
 * RTL utilities for manual RTL support
 * Use these when I18nManager.forceRTL() doesn't work properly
 */

// Force RTL to be true for our Arabic app
export const isRTL = true;

/**
 * Get flex direction based on RTL
 */
export const getFlexDirection = (reverse = false): 'row' | 'row-reverse' => {
  if (reverse) {
    return isRTL ? 'row' : 'row-reverse';
  }
  return isRTL ? 'row-reverse' : 'row';
};

/**
 * Get text alignment based on RTL
 */
export const getTextAlign = (align: 'left' | 'right' | 'center' = 'left'): 'left' | 'right' | 'center' => {
  if (align === 'center') return 'center';
  if (isRTL) {
    return align === 'left' ? 'right' : 'left';
  }
  return align;
};

/**
 * Transform object to use RTL-aware margins/paddings
 */
export const rtlStyle = (style: {
  marginLeft?: number;
  marginRight?: number;
  paddingLeft?: number;
  paddingRight?: number;
  left?: number;
  right?: number;
  [key: string]: any;
}) => {
  if (!isRTL) return style;

  const transformed = { ...style };

  // Swap margins
  if (style.marginLeft !== undefined || style.marginRight !== undefined) {
    transformed.marginLeft = style.marginRight;
    transformed.marginRight = style.marginLeft;
  }

  // Swap paddings
  if (style.paddingLeft !== undefined || style.paddingRight !== undefined) {
    transformed.paddingLeft = style.paddingRight;
    transformed.paddingRight = style.paddingLeft;
  }

  // Swap positions
  if (style.left !== undefined || style.right !== undefined) {
    transformed.left = style.right;
    transformed.right = style.left;
  }

  return transformed;
};
