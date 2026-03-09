export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="flex justify-center items-center gap-2 py-4 text-sm text-muted-foreground">
          <span>{currentYear} &copy;</span>
          <span>Kingspay Admin</span>
        </div>
      </div>
    </footer>
  );
}
