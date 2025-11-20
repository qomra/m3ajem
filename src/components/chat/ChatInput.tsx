import React, { useState, useImperativeHandle, useRef, forwardRef } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useTranslation } from '@hooks';

interface ChatInputProps {
  onSend: (message: string) => void;
  onFocus?: () => void;
  isSending?: boolean;
  disabled?: boolean;
}

export interface ChatInputRef {
  focus: () => void;
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
  ({ onSend, onFocus, isSending = false, disabled = false }, ref) => {
    const theme = useTheme();
    const { t } = useTranslation();
    const [message, setMessage] = useState('');
    const inputRef = useRef<TextInput>(null);

    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus();
      },
    }));

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !isSending) {
      onSend(trimmedMessage);
      setMessage('');
    }
  };

  const canSend = message.trim().length > 0 && !isSending && !disabled;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: theme.colors.text }]}
          placeholder={t('smart.inputPlaceholder')}
          placeholderTextColor={theme.colors.textTertiary}
          value={message}
          onChangeText={setMessage}
          onFocus={onFocus}
          multiline
          maxLength={2000}
          editable={!disabled && !isSending}
          textAlign="right"
        />

        <Pressable
          style={[
            styles.sendButton,
            {
              backgroundColor: canSend ? theme.colors.primary : theme.colors.background,
              opacity: canSend ? 1 : 0.5,
            },
          ]}
          onPress={handleSend}
          disabled={!canSend}
        >
          <Ionicons name="send" size={20} color={canSend ? '#FFFFFF' : theme.colors.textTertiary} />
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: 15,
    maxHeight: 120,
    paddingTop: 8,
    paddingBottom: 8,
    marginRight: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
