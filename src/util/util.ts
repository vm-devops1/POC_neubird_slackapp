import {linkAuthRoute, linkProjectBase, linkProjectChat, linkUsage, MessageContentType} from 'src/util/constant';

export function convertStringArrayToObjectArray(input: any) {
  try {
    return input.map(item => JSON.parse(item.replace(/'/g, '"')));
  } catch (error) {
    try {
      return input.map(item => JSON.parse(item));
    } catch (e) {
      throw new Error('Error while parsing');
    }
  }
}

export function getSystemDateTime() {
  const now = new Date();

  const dateOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };

  const timeOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  };

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  console.log('TIMEZONE---', timeZone); // TODO:issue here gives UTC always
  //@ts-ignore
  const date = now.toLocaleDateString('en-US', dateOptions);
  //@ts-ignore
  const time = now.toLocaleTimeString('en-US', timeOptions);

  return `${date} at ${time}`;
}

export function extractProgressStatus(input) {
  const start = input.indexOf('(');
  const end = input.indexOf(')');

  if (start !== -1 && end !== -1 && start < end) {
    return input.substring(start + 1, end);
  }

  return input;
}

export function generateUrl(promptId: string, projectId: string, sessionId: string, url: string) {
  return `${url}${linkAuthRoute}/${linkProjectBase}/${projectId}${linkProjectChat}/${sessionId}/${promptId}`;
}

export function separateTextAndFiles(input) {
  const files = [];
  let match;

  const allVisualisationRegex = /```(file)([\s\S]*?)```/g;
  // Extract all file-related blocks
  while ((match = allVisualisationRegex.exec(input)) !== null) {
    files.push(match[2].trim()); // Capture the file content and trim whitespace
  }

  // Remove all matched file blocks from the input text
  const text = input.replace(allVisualisationRegex, '').trim();

  return {
    text, // Remaining text without file blocks
    files, // Array of extracted file content
  };
}

export function removeHTML(content) {
  let finalContent = content;

  const allVisualisationRegex =
    /```(graph_line|graph_area|graph_bar|graph_pie|graph_doughnut|gauge|rca_pdf|split_view|diagram|table)([\s\S]*?)```/g;
  const matches = [];

  let match;
  while ((match = allVisualisationRegex.exec(finalContent)) !== null) {
    matches.push(match);
  }

  for (const match of matches) {
    finalContent = finalContent.replace(match[0], '');
  }

  // Continue processing the remaining content
  const replacedBr = finalContent?.replace(/\n?<br\/?>\n?/g, '\n');
  const replacedSpaces = replacedBr?.replace(/&nbsp;/g, ' ');
  const replacedHTML = replacedSpaces?.replace(/<[^>]+>/g, '');

  return replacedHTML
    .replace(/\*\*(.*?)\*\*/g, '*$1*')
    .replace(/~~(.*?)~~/g, '$1') // Remove strikethrough markdown
    .replace(/!\[(.*?)\]\((.*?)\)/g, '$1') // Remove image markdown
    .replace(/#{1,6}\s(.*?)(?:\r\n|\r|\n)/g, '$1');
  // .replace(/`([^`]*)`/g, "$1");
}
