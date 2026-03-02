"use client";

import { motion } from "motion/react";
import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AnimatedCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  delay?: number;
  icon?: ReactNode;
}

export function AnimatedCard({
  title,
  children,
  className,
  delay = 0,
  icon,
}: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
    >
      <Card
        className={cn("h-full transition-shadow hover:shadow-lg", className)}
      >
        {title && (
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              {icon}
              {title}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className={!title ? "pt-6" : ""}>{children}</CardContent>
      </Card>
    </motion.div>
  );
}
