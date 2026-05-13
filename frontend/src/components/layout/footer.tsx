import { Separator } from "@/components/ui/separator";

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Separator className="mb-6" />
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium">TechSphere Commerce</p>
            <p>Web thương mại điện tử máy tính và công nghệ - KTTKPM, IUH</p>
          </div>
          <div className="text-sm text-muted-foreground">
            Event-Driven Architecture &bull; Microservices &bull; Saga Pattern
          </div>
        </div>
      </div>
    </footer>
  );
}
