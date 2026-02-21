import type { SummaryLength, SummaryLanguage } from '@/types';
import { LANGUAGE_NAMES, DEFAULT_SUMMARY_LANGUAGE } from '@/constants';

const LENGTH_INSTRUCTIONS: Record<SummaryLength, string> = {
  short: `Keep the summary very concise — aim for 3-5 bullet points covering only the most important takeaways.
Skip the "Notable Quotes" and "Conclusion" sections entirely.`,

  medium: `Provide a balanced summary with moderate detail.
Include 2-3 subsections under Key Points. Include a brief Notable Quotes section if relevant.`,

  long: `Provide a comprehensive, detailed summary covering all major topics thoroughly.
Include many subsections under Key Points with extensive bullet points.
Include multiple Notable Quotes with context. Add nuance and supporting details wherever possible.`,
};

const BASE_PROMPT = `You are a helpful assistant that summarizes YouTube video transcripts.
Given a transcript, provide a clear, well-structured summary using this markdown format:

# Video Title (infer from context)

## Overview
2-3 sentence overview of the video.

## Key Points
Use h3 headings (###) for each major topic or point. Under each heading, use bullet points for supporting details.

### Topic Name
- Detail one
- Detail two

## Notable Quotes
> Use blockquotes for notable quotes.

## Conclusion
Brief concluding thoughts.

Important formatting rules:
- Always use ## for section headings and ### for sub-topic headings
- Never put headings inside bullet points
- Use bullet points only for supporting details under a heading

Timestamp rules:
- If the transcript includes timestamps in [M:SS] or [H:MM:SS] format, follow these rules. If no timestamps are present, do not invent them — simply omit timestamps from the summary
- When summarizing key points, include the relevant timestamp so users can jump to that moment
- Place timestamps inline naturally, e.g. "The speaker explains X [2:15] and then covers Y [5:30]"
- Always place timestamps AFTER punctuation, never before. Correct: "The filtering technique: [5:47]" — Wrong: "The filtering technique [5:47]:"
- Use the exact format [M:SS] or [H:MM:SS] — do not alter the bracket notation`;

export function getSummarizePrompt(length: SummaryLength = 'medium', language: SummaryLanguage = DEFAULT_SUMMARY_LANGUAGE): string {
  let prompt = `${BASE_PROMPT}\n\nLength guideline: ${LENGTH_INSTRUCTIONS[length]}`;
  if (language !== DEFAULT_SUMMARY_LANGUAGE) {
    prompt += `\n\nWrite the entire summary in ${LANGUAGE_NAMES[language]}. Translate everything — section headings, sub-headings, prose, bullet points, and quoted text — into ${LANGUAGE_NAMES[language]}.`;
    if (language === 'as') {
      prompt += ` Use pure native Assamese (অসমীয়া) script and vocabulary. Do NOT use Bengali — Assamese has its own distinct script, grammar, and vocabulary.`;
    }
  }
  return prompt;
}
