/**
 * Stage 2: Segmentation.
 * Split normalized text into structural blocks by headings.
 */

export interface Section {
  level: number;       // heading depth: 1 = #, 2 = ##, 3 = ###
  title: string;
  body: string;
  startLine: number;
  endLine: number;
}

export function segment(text: string): Section[] {
  const lines = text.split("\n");
  const sections: Section[] = [];
  let current: Section | null = null;
  let bodyLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      // Close previous section
      if (current) {
        current.body = bodyLines.join("\n").trim();
        current.endLine = i;
        sections.push(current);
      }

      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();

      current = {
        level,
        title,
        body: "",
        startLine: i + 1, // 1-indexed
        endLine: i + 1,
      };
      bodyLines = [];
    } else {
      bodyLines.push(line);
    }
  }

  // Close last section
  if (current) {
    current.body = bodyLines.join("\n").trim();
    current.endLine = lines.length;
    sections.push(current);
  }

  // If no headings found, treat entire text as a single section
  if (sections.length === 0 && text.trim()) {
    sections.push({
      level: 0,
      title: "Untitled",
      body: text.trim(),
      startLine: 1,
      endLine: lines.length,
    });
  }

  return sections;
}
