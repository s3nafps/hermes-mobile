import { Linking, ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';

import { MONO, tokens } from '@/constants/tokens';
import { parseBlocks, parseInline, type Block, type Inline } from '@/lib/chat/markdown';
import { themed } from '@/lib/theme';

// Renders an assistant reply: headings, lists, quotes, code blocks and inline emphasis.
export function Markdown({ source }: { source: string }) {
  return (
    <View style={{ gap: 10 }}>
      {parseBlocks(source).map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </View>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'heading': {
      const size = block.level === 1 ? 20 : block.level === 2 ? 18 : 16;
      return <InlineText text={block.text} style={{ fontSize: size, fontWeight: '600', lineHeight: size * 1.35 }} />;
    }
    case 'paragraph':
      return <InlineText text={block.text} />;
    case 'code':
      return (
        <View style={styles.code}>
          {block.language ? <Text style={styles.language}>{block.language}</Text> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text style={styles.codeText}>
              {block.code}
            </Text>
          </ScrollView>
        </View>
      );
    case 'list':
      return (
        <View style={{ gap: 6 }}>
          {block.items.map((item, index) => (
            <View key={index} style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={[styles.body, styles.marker]}>{block.ordered ? `${index + 1}.` : '•'}</Text>
              <InlineText text={item} style={{ flex: 1 }} />
            </View>
          ))}
        </View>
      );
    case 'quote':
      return (
        <View style={styles.quote}>
          <InlineText text={block.text} style={{ color: tokens.textMuted }} />
        </View>
      );
  }
}

// Text with bold, italic, code and links inside it. Line breaks in the text are kept.
function InlineText({ text, style }: { text: string; style?: TextStyle }) {
  return (
    <Text style={[styles.body, style]}>
      {parseInline(text).map((span, index) => (
        <SpanView key={index} span={span} />
      ))}
    </Text>
  );
}

function SpanView({ span }: { span: Inline }) {
  switch (span.type) {
    case 'text':
      return span.text;
    case 'bold':
      return <Text style={{ fontWeight: '700' }}>{span.text}</Text>;
    case 'italic':
      return <Text style={{ fontStyle: 'italic' }}>{span.text}</Text>;
    case 'code':
      return <Text style={styles.inlineCode}>{span.text}</Text>;
    case 'link':
      return (
        <Text style={styles.link} onPress={() => void openLink(span.url)} accessibilityRole="link">
          {span.text}
        </Text>
      );
  }
}

// Only web addresses open. Anything else in a reply stays as text.
async function openLink(url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) return;
  await Linking.openURL(url).catch(() => undefined);
}

const styles = themed(() => StyleSheet.create({
  body: {
    color: tokens.text,
    fontSize: 15,
    lineHeight: 22,
  },
  marker: {
    color: tokens.textMuted,
    minWidth: 18,
  },
  code: {
    gap: 6,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.line,
    backgroundColor: tokens.bg,
  },
  language: {
    color: tokens.textMuted,
    fontSize: 11,
  },
  codeText: {
    color: tokens.text,
    fontFamily: MONO,
    fontSize: 13,
    lineHeight: 19,
  },
  inlineCode: {
    color: tokens.text,
    fontFamily: MONO,
    fontSize: 14,
    backgroundColor: tokens.bg,
  },
  link: {
    color: tokens.info,
    textDecorationLine: 'underline',
  },
  quote: {
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderLeftColor: tokens.accent,
  },
}));
