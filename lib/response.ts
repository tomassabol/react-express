export function Response({
  json,
  status,
  text,
  html,
  headers,
  redirect,
}: {
  json?: any;
  status?: number;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  redirect?: string;
}): React.ReactElement {
  return {
    type: "Response",
    props: { json, status, text, html, headers, redirect },
  } as any;
}
