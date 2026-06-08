import { motion } from 'framer-motion';
import { LucideIcon, CheckCircle2 } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const FeatureCard = ({ icon: Icon, title, description }: FeatureCardProps) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 hover:border-white/40 transition-colors group"
  >
    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
      <Icon className="text-white w-6 h-6" />
    </div>
    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
    <p className="text-gray-300 leading-relaxed">{description}</p>
  </motion.div>
);

export const NodeTier = ({ tier, color, perks, description }: { tier: string, color: string, perks: string[], description: string }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.9 }}
    whileInView={{ opacity: 1, scale: 1 }}
    viewport={{ once: true }}
    className={`relative p-8 rounded-3xl border-2 ${color} bg-black/40 backdrop-blur-xl overflow-hidden group`}
  >
    <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all" />
    <div className="relative z-10">
      <div className="text-sm font-black uppercase tracking-widest text-white/50 mb-2">Nivel de Nodo</div>
      <h3 className="text-4xl font-black text-white mb-4 italic tracking-tighter">{tier}</h3>
      <p className="text-gray-400 mb-6 italic">{description}</p>
      <ul className="space-y-3 mb-8">
        {perks.map((perk, i) => (
          <li key={i} className="flex items-center text-gray-200 text-sm">
            <CheckCircle2 className="w-4 h-4 mr-2 text-yellow-500" /> {perk}
          </li>
        ))}
      </ul>
      <div className="w-full py-3 rounded-xl bg-white text-black font-bold text-center hover:bg-gray-200 transition-colors cursor-pointer uppercase text-xs tracking-widest">
        Ver Requisitos
      </div>
    </div>
  </motion.div>
);
