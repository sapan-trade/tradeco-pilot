"use client";
import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useRef } from "react";
import { Boxes, ScanLine, FileCheck, AlertTriangle, type LucideIcon } from "lucide-react";

const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };

const ICON: Record<string, LucideIcon> = {
  Boxes, ScanLine, FileCheck, AlertTriangle,
};

function Counter({ to, prefix = "", suffix = "" }: { to: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (l) => `${prefix}${Math.round(l).toLocaleString()}${suffix}`);
  useEffect(() => {
    if (inView) {
      const ctrl = animate(mv, to, { duration: 1.1, ease: [0.16, 1, 0.3, 1] });
      return ctrl.stop;
    }
  }, [inView, mv, to]);
  return <motion.span ref={ref}>{rounded}</motion.span>;
}

export interface DashboardStat {
  label: string;
  value: number;
  sub?: string;
  iconName: keyof typeof ICON;
}

export function DashboardStats({ stats }: { stats: DashboardStat[] }) {
  return (
    <motion.div initial="hidden" animate="visible" variants={stagger} className="stat-cards">
      {stats.map((s) => {
        const Icon = ICON[s.iconName];
        return (
          <motion.div key={s.label} variants={fadeUp} className="stat-card">
            <div className="stat-card-label">
              <Icon size={14} />
              {s.label}
            </div>
            <div className="stat-card-value">
              <Counter to={s.value} />
            </div>
            {s.sub && <div className="stat-card-sub">{s.sub}</div>}
          </motion.div>
        );
      })}
    </motion.div>
  );
}
