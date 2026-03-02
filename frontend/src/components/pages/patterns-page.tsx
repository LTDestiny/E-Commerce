"use client";

import { motion } from "motion/react";
import {
  Blocks,
  GitBranch,
  Database,
  Radio,
  Shield,
  MailX,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { AnimatedCard } from "@/components/shared/animated-card";
import { Badge } from "@/components/ui/badge";
import { PATTERNS } from "@/lib/constants";

const iconMap = {
  GitBranch,
  Database,
  Radio,
  Shield,
  MailX,
  Zap,
};

export default function PatternsPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Design Patterns"
        description="6 patterns chính được áp dụng trong hệ thống"
        icon={<Blocks className="h-6 w-6 text-primary" />}
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {PATTERNS.map((pattern, i) => {
          const Icon = iconMap[pattern.icon as keyof typeof iconMap];
          return (
            <motion.div
              key={pattern.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <AnimatedCard
                title={pattern.name}
                icon={<Icon className="h-5 w-5 text-primary" />}
                className="h-full"
              >
                <div className="space-y-3">
                  <Badge variant="secondary">{pattern.subtitle}</Badge>
                  <p className="text-sm text-muted-foreground">
                    {pattern.description}
                  </p>
                </div>
              </AnimatedCard>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
