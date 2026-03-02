import { Separator } from "@/components/ui/separator";

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Separator className="mb-6" />
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium">E-Commerce Order Processing System</p>
            <p>Kiến Trúc & Thiết Kế Phần Mềm — HK8, IUH</p>
          </div>
          <div className="text-sm text-muted-foreground">
            Event-Driven Architecture &bull; Microservices &bull; CQRS
          </div>
        </div>
      </div>
    </footer>
  );
}
