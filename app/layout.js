export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          {`
          @keyframes move {
            0% { left: 0%; }
            20% { left: 50%; }
            40% { left: 50%; }   /* pause at B */
            60% { left: 100%; }
            80% { left: 100%; }  /* pause at C */
            100% { left: 0%; }
          }

          .animate-move {
            animation: move 4s ease-in-out infinite;
          }
          `}
        </style>
      </head>
      <body>{children}</body>
    </html>
  );
}