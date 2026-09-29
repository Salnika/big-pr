import { useEffect, useMemo, useState } from "react";
import { classNames } from "../../shared/lib/class-names";
import {
  buildCodeDocument,
  type CodeWindow,
  defaultCodeWindow,
  expandCodeWindow,
  getCodeLineNumber,
  getDiffLinePrefix,
  getVisibleCodeRange,
  splitFileLines,
  type ThreadCodeSource,
} from "./code-context";
import { diffLineTone } from "./PullRequestReview.css";
import * as styles from "./ThreadCodePreview.css";

export type LoadFileContent = (input: { path: string; ref: string }) => Promise<string>;

type ExpandDirection = "down" | "up";
type FileState = {
  lines: string[] | null;
  status: "error" | "idle" | "loaded" | "loading";
};

const expandLineCount = 10;

export function ThreadCodePreview({
  id,
  label,
  onLoadFileContent,
  source,
}: {
  id: string;
  label: string;
  onLoadFileContent: LoadFileContent;
  source: ThreadCodeSource;
}) {
  const [codeWindow, setCodeWindow] = useState<CodeWindow>(defaultCodeWindow);
  const [fileState, setFileState] = useState<FileState>(() => ({
    lines: null,
    status: source.fileRef ? "loading" : "idle",
  }));
  const codeDocument = useMemo(
    () => buildCodeDocument(source, fileState.lines),
    [fileState.lines, source],
  );
  const isLoading = fileState.status === "loading";

  useEffect(() => {
    const ref = source.fileRef;

    if (!ref) {
      return;
    }

    let isCurrent = true;

    onLoadFileContent({ path: source.path, ref }).then(
      (content) => {
        if (isCurrent) {
          setFileState({ lines: splitFileLines(content), status: "loaded" });
        }
      },
      () => {
        if (isCurrent) {
          setFileState({ lines: null, status: "error" });
        }
      },
    );

    return () => {
      isCurrent = false;
    };
  }, [onLoadFileContent, source.fileRef, source.path]);

  if (!codeDocument) {
    return (
      <section aria-label={label} className={styles.preview} id={id}>
        <div className={styles.status} role="status">
          {isLoading ? "Loading code..." : "The commented code could not be found in this file."}
        </div>
      </section>
    );
  }

  const range = getVisibleCodeRange(codeDocument, codeWindow);
  const visibleRows = codeDocument.rows.slice(range.start, range.end + 1);
  const hiddenRowsAbove = range.start;
  const hiddenRowsBelow = codeDocument.rows.length - 1 - range.end;
  const lineNumbers = visibleRows
    .map((row) => getCodeLineNumber(row, source.end.side))
    .filter((lineNumber) => lineNumber !== null);
  const totalLines = source.end.side === "new" ? fileState.lines?.length : undefined;
  const isExpanded =
    codeWindow.above > defaultCodeWindow.above || codeWindow.below > defaultCodeWindow.below;
  const expand = (direction: ExpandDirection) =>
    setCodeWindow((current) => expandCodeWindow(codeDocument, current, direction, expandLineCount));

  return (
    <section aria-label={label} className={styles.preview} id={id}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarText}>
          <span className={styles.meta}>
            {formatLineRange(lineNumbers)}
            {totalLines ? ` of ${totalLines}` : null}
          </span>
          {source.isOriginal ? (
            <span className={styles.note}>Outdated: code as it was when commented</span>
          ) : null}
          {fileState.status === "error" ? (
            <span className={styles.note}>Full file unavailable, showing the diff only</span>
          ) : null}
        </div>
        {isExpanded ? (
          <button
            className={styles.resetButton}
            onClick={() => setCodeWindow(defaultCodeWindow)}
            type="button"
          >
            Collapse
          </button>
        ) : null}
      </div>
      <div className={styles.body}>
        {hiddenRowsAbove > 0 || (isLoading && codeDocument.mayHaveHiddenLinesAbove) ? (
          <CodeExpander
            direction="up"
            hiddenRows={hiddenRowsAbove}
            isLoading={isLoading}
            onExpand={() => expand("up")}
          />
        ) : null}
        {visibleRows.map((row, index) => {
          const rowIndex = range.start + index;
          const isTarget =
            rowIndex >= codeDocument.targetStart && rowIndex <= codeDocument.targetEnd;

          return (
            <div
              className={classNames(
                styles.line,
                diffLineTone[row.type],
                isTarget ? styles.lineTarget : undefined,
              )}
              key={row.id}
            >
              <span className={styles.lineNumber}>{row.oldLineNumber ?? ""}</span>
              <span className={styles.lineNumber}>{row.newLineNumber ?? ""}</span>
              <pre className={styles.code}>
                <span aria-hidden="true" className={styles.prefix}>
                  {getDiffLinePrefix(row)}
                </span>
                <span>{row.content || " "}</span>
              </pre>
            </div>
          );
        })}
        {hiddenRowsBelow > 0 || (isLoading && codeDocument.mayHaveHiddenLinesBelow) ? (
          <CodeExpander
            direction="down"
            hiddenRows={hiddenRowsBelow}
            isLoading={isLoading}
            onExpand={() => expand("down")}
          />
        ) : null}
      </div>
    </section>
  );
}

function CodeExpander({
  direction,
  hiddenRows,
  isLoading,
  onExpand,
}: {
  direction: ExpandDirection;
  hiddenRows: number;
  isLoading: boolean;
  onExpand: () => void;
}) {
  const lineCount = Math.min(expandLineCount, hiddenRows);

  return (
    <button
      className={styles.expander[direction]}
      disabled={isLoading}
      onClick={onExpand}
      type="button"
    >
      <svg
        aria-hidden="true"
        className={styles.expanderIcon}
        height="12"
        viewBox="0 0 16 16"
        width="12"
      >
        <path
          d={direction === "up" ? "M8 2 2.5 8H6v6h4V8h3.5L8 2Z" : "M8 14 2.5 8H6V2h4v6h3.5L8 14Z"}
          fill="currentColor"
        />
      </svg>
      {isLoading
        ? "Loading more lines..."
        : `Show ${lineCount} more ${lineCount === 1 ? "line" : "lines"} ${direction === "up" ? "above" : "below"}`}
    </button>
  );
}

function formatLineRange(lineNumbers: number[]) {
  const firstLine = lineNumbers[0];
  const lastLine = lineNumbers.at(-1);

  if (firstLine === undefined || lastLine === undefined) {
    return "";
  }

  return firstLine === lastLine ? `Line ${firstLine}` : `Lines ${firstLine}-${lastLine}`;
}
