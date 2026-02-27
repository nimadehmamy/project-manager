import { useEffect, useRef } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, StreamLanguage } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches, openSearchPanel } from '@codemirror/search';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { oneDark } from '@codemirror/theme-one-dark';

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
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
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

    if (darkMode) {
      extensions.push(oneDark);
    }

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
