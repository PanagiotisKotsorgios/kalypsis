import { Box, type SxProps, type Theme } from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function ReleaseMarkdown({
  children,
  compact = false,
  sx
}: {
  children: string;
  compact?: boolean;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box
      sx={[
        {
          color: "#3d4f6b",
          fontSize: compact ? 14 : { xs: 14.5, md: 15.5 },
          lineHeight: 1.72,
          overflowWrap: "anywhere",
          "& > :first-of-type": { mt: 0 },
          "& > :last-child": { mb: 0 },
          "& h1, & h2, & h3, & h4": {
            color: "#0b2545",
            fontWeight: 850,
            lineHeight: 1.25,
            letterSpacing: "-0.015em",
            mt: compact ? 2 : 4,
            mb: 1.25
          },
          "& h1": { fontSize: compact ? 21 : { xs: 28, md: 36 } },
          "& h2": { fontSize: compact ? 18 : { xs: 23, md: 28 }, pb: 1, borderBottom: "1px solid #e5e9ef" },
          "& h3": { fontSize: compact ? 16 : { xs: 19, md: 21 } },
          "& h4": { fontSize: compact ? 15 : 17 },
          "& p": { my: 1.2 },
          "& ul, & ol": { pl: 3.2, my: 1.25 },
          "& li": { my: 0.45, pl: 0.35 },
          "& li::marker": { color: "#1f7bb3", fontWeight: 800 },
          "& strong": { color: "#0b2545", fontWeight: 800 },
          "& a": { color: "#126da4", fontWeight: 700, textDecorationThickness: "1px", textUnderlineOffset: "3px" },
          "& code": {
            px: 0.65,
            py: 0.2,
            borderRadius: 0.75,
            bgcolor: "#edf3f8",
            color: "#17385e",
            fontFamily: '"Cascadia Code", "SFMono-Regular", Consolas, monospace',
            fontSize: "0.88em"
          },
          "& pre": {
            my: 2,
            p: { xs: 1.75, md: 2.25 },
            borderRadius: 2,
            bgcolor: "#152640",
            color: "#e6eef7",
            overflowX: "auto",
            border: "1px solid rgba(148,191,230,0.2)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)"
          },
          "& pre code": { p: 0, bgcolor: "transparent", color: "inherit", fontSize: 12.5, whiteSpace: "pre" },
          "& blockquote": { my: 2, mx: 0, pl: 2, py: 0.25, borderLeft: "4px solid #1f7bb3", color: "#52647d", bgcolor: "#f7fafc" },
          "& hr": { my: 3, border: 0, borderTop: "1px solid #e5e9ef" },
          "& table": { width: "100%", my: 2, borderCollapse: "collapse", display: "block", overflowX: "auto" },
          "& th": { bgcolor: "#f3f7fa", color: "#0b2545", fontWeight: 800 },
          "& th, & td": { px: 1.5, py: 1.1, border: "1px solid #dce4ec", textAlign: "left", verticalAlign: "top" },
          "& input[type='checkbox']": { accentColor: "#1f7bb3" },
          "& img": { maxWidth: "100%", height: "auto", borderRadius: 2 }
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : [])
      ]}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
        {children}
      </ReactMarkdown>
    </Box>
  );
}

export default ReleaseMarkdown;
