import { useEffect, useRef } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { foldGutter, indentOnInput, syntaxHighlighting, HighlightStyle, bracketMatching, StreamLanguage } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches, openSearchPanel } from '@codemirror/search';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { tags as t } from '@lezer/highlight';

// Native CodeMirror 6 languages
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { html } from '@codemirror/lang-html';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';

// Legacy modes for additional languages
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { yaml } from '@codemirror/legacy-modes/mode/yaml';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { lua } from '@codemirror/legacy-modes/mode/lua';
import { r } from '@codemirror/legacy-modes/mode/r';
import { sql as sqlMode } from '@codemirror/legacy-modes/mode/sql';
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile';
import { diff } from '@codemirror/legacy-modes/mode/diff';

// --- VS Code Dark+ theme ---
const vscodeDarkTheme = EditorView.theme({
  '&': { backgroundColor: '#1e1e1e', color: '#d4d4d4' },
  '.cm-content': { caretColor: '#d4d4d4' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#d4d4d4' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: '#264f78' },
  '.cm-activeLine': { backgroundColor: '#2a2d2e' },
  '.cm-gutters': { backgroundColor: '#1e1e1e', color: '#858585', borderRight: '1px solid #333' },
  '.cm-activeLineGutter': { backgroundColor: '#2a2d2e', color: '#c6c6c6' },
  '.cm-foldGutter': { color: '#858585' },
  '.cm-selectionMatch': { backgroundColor: '#add6ff26' },
  '.cm-matchingBracket': { backgroundColor: '#0064001a', outline: '1px solid #888' },
  '.cm-searchMatch': { backgroundColor: '#ea5c0055' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: '#ea5c00aa' },
  '.cm-panels': { backgroundColor: '#252526', color: '#d4d4d4' },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid #333' },
  '.cm-panel.cm-search label': { fontSize: '0.8125rem' },
  '.cm-panel.cm-search input, .cm-panel.cm-search button': { fontSize: '0.8125rem' },
  '.cm-tooltip': { backgroundColor: '#252526', border: '1px solid #454545', color: '#d4d4d4' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: '#094771', color: '#ffffff' },
}, { dark: true });

const vscodeDarkHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#569cd6' },
  { tag: t.controlKeyword, color: '#c586c0' },
  { tag: [t.definition(t.variableName), t.function(t.variableName)], color: '#dcdcaa' },
  { tag: t.variableName, color: '#9cdcfe' },
  { tag: [t.typeName, t.className, t.namespace], color: '#4ec9b0' },
  { tag: t.propertyName, color: '#9cdcfe' },
  { tag: [t.string, t.special(t.string)], color: '#ce9178' },
  { tag: t.regexp, color: '#d16969' },
  { tag: t.number, color: '#b5cea8' },
  { tag: t.bool, color: '#569cd6' },
  { tag: t.null, color: '#569cd6' },
  { tag: t.operator, color: '#d4d4d4' },
  { tag: t.punctuation, color: '#d4d4d4' },
  { tag: t.comment, color: '#6a9955', fontStyle: 'italic' },
  { tag: t.lineComment, color: '#6a9955', fontStyle: 'italic' },
  { tag: t.blockComment, color: '#6a9955', fontStyle: 'italic' },
  { tag: t.meta, color: '#569cd6' },
  { tag: t.tagName, color: '#569cd6' },
  { tag: t.attributeName, color: '#9cdcfe' },
  { tag: t.attributeValue, color: '#ce9178' },
  { tag: t.heading, color: '#569cd6', fontWeight: 'bold' },
  { tag: t.link, color: '#569cd6', textDecoration: 'underline' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strong, fontWeight: 'bold' },
]);

const vscodeDark = [vscodeDarkTheme, syntaxHighlighting(vscodeDarkHighlight)];

// --- VS Code Light+ theme ---
const vscodeLightTheme = EditorView.theme({
  '&': { backgroundColor: '#ffffff', color: '#000000' },
  '.cm-content': { caretColor: '#000000' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#000000' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: '#add6ff' },
  '.cm-activeLine': { backgroundColor: '#f0f0f0' },
  '.cm-gutters': { backgroundColor: '#ffffff', color: '#999999', borderRight: '1px solid #e0e0e0' },
  '.cm-activeLineGutter': { backgroundColor: '#f0f0f0', color: '#333333' },
  '.cm-foldGutter': { color: '#999999' },
  '.cm-selectionMatch': { backgroundColor: '#add6ff80' },
  '.cm-matchingBracket': { backgroundColor: '#bad0f847', outline: '1px solid #b9b9b9' },
  '.cm-searchMatch': { backgroundColor: '#ea5c0055' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: '#ea5c00aa' },
  '.cm-panels': { backgroundColor: '#f3f3f3', color: '#333333' },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid #e0e0e0' },
  '.cm-panel.cm-search label': { fontSize: '0.8125rem' },
  '.cm-panel.cm-search input, .cm-panel.cm-search button': { fontSize: '0.8125rem' },
  '.cm-tooltip': { backgroundColor: '#f3f3f3', border: '1px solid #c8c8c8', color: '#333333' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: '#0060c0', color: '#ffffff' },
}, { dark: false });

const vscodeLightHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#0000ff' },
  { tag: t.controlKeyword, color: '#af00db' },
  { tag: [t.definition(t.variableName), t.function(t.variableName)], color: '#795e26' },
  { tag: t.variableName, color: '#001080' },
  { tag: [t.typeName, t.className, t.namespace], color: '#267f99' },
  { tag: t.propertyName, color: '#001080' },
  { tag: [t.string, t.special(t.string)], color: '#a31515' },
  { tag: t.regexp, color: '#811f3f' },
  { tag: t.number, color: '#098658' },
  { tag: t.bool, color: '#0000ff' },
  { tag: t.null, color: '#0000ff' },
  { tag: t.operator, color: '#000000' },
  { tag: t.punctuation, color: '#000000' },
  { tag: t.comment, color: '#008000', fontStyle: 'italic' },
  { tag: t.lineComment, color: '#008000', fontStyle: 'italic' },
  { tag: t.blockComment, color: '#008000', fontStyle: 'italic' },
  { tag: t.meta, color: '#0000ff' },
  { tag: t.tagName, color: '#800000' },
  { tag: t.attributeName, color: '#ff0000' },
  { tag: t.attributeValue, color: '#0000ff' },
  { tag: t.heading, color: '#0000ff', fontWeight: 'bold' },
  { tag: t.link, color: '#0000ff', textDecoration: 'underline' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strong, fontWeight: 'bold' },
]);

const vscodeLight = [vscodeLightTheme, syntaxHighlighting(vscodeLightHighlight)];

const LANG_MAP: Record<string, () => any> = {
  // Native CM6 languages
  js: () => javascript(),
  jsx: () => javascript({ jsx: true }),
  ts: () => javascript({ typescript: true }),
  tsx: () => javascript({ typescript: true, jsx: true }),
  mjs: () => javascript(),
  cjs: () => javascript(),
  py: () => python(),
  css: () => css(),
  scss: () => css(),
  less: () => css(),
  json: () => json(),
  md: () => markdown(),
  markdown: () => markdown(),
  html: () => html(),
  htm: () => html(),
  xml: () => html(),
  svg: () => html(),
  c: () => cpp(),
  cpp: () => cpp(),
  h: () => cpp(),
  hpp: () => cpp(),
  cc: () => cpp(),
  cxx: () => cpp(),
  java: () => java(),
  rs: () => rust(),
  go: () => go(),
  // Legacy modes (via StreamLanguage)
  tex: () => StreamLanguage.define(stex),
  sty: () => StreamLanguage.define(stex),
  cls: () => StreamLanguage.define(stex),
  bib: () => StreamLanguage.define(stex),
  bst: () => StreamLanguage.define(stex),
  yaml: () => StreamLanguage.define(yaml),
  yml: () => StreamLanguage.define(yaml),
  toml: () => StreamLanguage.define(toml),
  sh: () => StreamLanguage.define(shell),
  bash: () => StreamLanguage.define(shell),
  zsh: () => StreamLanguage.define(shell),
  fish: () => StreamLanguage.define(shell),
  lua: () => StreamLanguage.define(lua),
  r: () => StreamLanguage.define(r),
  sql: () => StreamLanguage.define(sqlMode({})),
  dockerfile: () => StreamLanguage.define(dockerFile),
  diff: () => StreamLanguage.define(diff),
  patch: () => StreamLanguage.define(diff),
};

interface CodeViewerProps {
  content: string;
  filename: string;
  darkMode?: boolean;
  readOnly?: boolean;
  onContentChange?: (content: string) => void;
}

export function CodeViewer({ content, filename, darkMode = true, readOnly = true, onContentChange }: CodeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Create/recreate editor when filename, readOnly, or darkMode changes
  useEffect(() => {
    if (!containerRef.current) return;

    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const base = filename.toLowerCase();
    const langFn = LANG_MAP[ext] || LANG_MAP[base];

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      highlightSelectionMatches(),
      foldGutter(),
      history(),
    ];

    if (readOnly) {
      extensions.push(
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
      );
    } else {
      extensions.push(
        keymap.of([
          ...closeBracketsKeymap,
          ...completionKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),
        closeBrackets(),
        autocompletion(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && onContentChange) {
            onContentChange(update.state.doc.toString());
          }
        }),
      );
    }

    // Theme: VS Code Dark+ or Light+
    extensions.push(...(darkMode ? vscodeDark : vscodeLight));

    if (langFn) {
      extensions.push(langFn());
    }

    const state = EditorState.create({
      doc: content,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filename, readOnly, darkMode]);

  // Push content updates in read-only mode without recreating editor
  useEffect(() => {
    if (!readOnly || !viewRef.current) return;
    const view = viewRef.current;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== content) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: content },
      });
    }
  }, [content, readOnly]);

  // Expose Ctrl+F to open search panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && viewRef.current) {
        e.preventDefault();
        openSearchPanel(viewRef.current);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return <div ref={containerRef} className="code-viewer-cm" />;
}
