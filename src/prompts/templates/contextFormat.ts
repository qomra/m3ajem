import type { ChatContext } from '@/types/chat';

/**
 * Format a single context item for inclusion in the message
 */
export function formatContext(context: ChatContext): string {
  switch (context.type) {
    case 'definition':
      return formatDefinitionContext(context);
    case 'root':
      return formatRootContext(context);
    case 'word':
      return formatWordContext(context);
    default:
      return '';
  }
}

/**
 * Format a definition context
 */
function formatDefinitionContext(context: ChatContext): string {
  const { root, dictionaryName } = context.metadata;
  return `
[سياق من معجم ${dictionaryName}]
المادة: ${root}
التعريف: ${context.content}
`;
}

/**
 * Format a root context
 */
function formatRootContext(context: ChatContext): string {
  const { root, dictionaryName } = context.metadata;
  return `
[معلومات عن المادة]
المادة: ${root}
المعجم: ${dictionaryName}
`;
}

/**
 * Format a word context
 */
function formatWordContext(context: ChatContext): string {
  const { word, root, dictionaryName } = context.metadata;
  return `
[معلومات عن الكلمة]
الكلمة: ${word}
المادة: ${root}
المعجم: ${dictionaryName}
`;
}

/**
 * Format multiple contexts into a single string
 */
export function formatContexts(contexts: ChatContext[]): string {
  if (contexts.length === 0) {
    return '';
  }

  const header = '\n--- السياق المرفق ---\n';
  const formattedContexts = contexts.map(formatContext).join('\n');
  const footer = '\n--- نهاية السياق ---\n';

  return header + formattedContexts + footer;
}
