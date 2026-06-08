"""
Rabbitty Global Rewards Engine
Algoritmo de recompensas globales con integración fiscal, de engagement y gobernanza
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from pathlib import Path
import hashlib

logger = logging.getLogger("rabbitty_rewards")


@dataclass
class RewardCalculation:
    """Estructura de cálculo de recompensas"""
    base_reward: float
    level_multiplier: float
    streak_multiplier: float
    governance_multiplier: float
    fiscal_score: int
    engagement_score: int
    governance_score: int
    total_reward: float
    breakdown: Dict[str, float]


@dataclass
class UserMetrics:
    """Métricas de usuario para cálculos"""
    rfc: str
    level: int
    experience: int
    consecutive_months: int
    cfdi_count: int
    total_fiscal_volume: float
    compliance_score: float
    check_in_streak: int
    referrals_count: int
    governance_votes: int
    proposals_created: int
    last_activity: datetime


class GlobalRewardsEngine:
    """
    Motor de recompensas globales Rabbitty
    
    Algoritmo:
    total = base * (1 + level*0.02) * (1 + streak*0.05) * (1 + governance*0.01)
    
    Componentes:
    - Fiscal (40%): Actividad fiscal SAT
    - Engagement (30%): Interacción con plataforma
    - Governance (20%): Participación en DAO
    - Staking (10%): Bloqueo de tokens
    """
    
    # Pesos de distribución
    WEIGHTS = {
        'fiscal': 0.40,
        'engagement': 0.30,
        'governance': 0.20,
        'staking': 0.10
    }
    
    # Multiplicadores
    LEVEL_BONUS_RATE = 0.02  # 2% por nivel
    STREAK_BONUS_RATE = 0.05  # 5% por mes consecutivo
    GOVERNANCE_BONUS_RATE = 0.01  # 1% por punto de gobernanza
    
    def __init__(self, data_dir: str = "data/rewards"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.user_metrics: Dict[str, UserMetrics] = {}
        self.reward_history: Dict[str, List[Dict]] = {}
        self._load_data()
    
    def _load_data(self):
        """Cargar datos persistentes"""
        metrics_file = self.data_dir / "user_metrics.json"
        if metrics_file.exists():
            with open(metrics_file, 'r') as f:
                data = json.load(f)
                for rfc, m in data.items():
                    m['last_activity'] = datetime.fromisoformat(m['last_activity'])
                    self.user_metrics[rfc] = UserMetrics(**m)
        
        history_file = self.data_dir / "reward_history.json"
        if history_file.exists():
            with open(history_file, 'r') as f:
                self.reward_history = json.load(f)
    
    def _save_data(self):
        """Guardar datos persistentes"""
        metrics_file = self.data_dir / "user_metrics.json"
        metrics_dict = {}
        for rfc, m in self.user_metrics.items():
            d = asdict(m)
            d['last_activity'] = d['last_activity'].isoformat()
            metrics_dict[rfc] = d
        with open(metrics_file, 'w') as f:
            json.dump(metrics_dict, f, indent=2)
        
        history_file = self.data_dir / "reward_history.json"
        with open(history_file, 'w') as f:
            json.dump(self.reward_history, f, indent=2)
    
    def register_user(self, rfc: str, level: int = 1) -> UserMetrics:
        """Registrar nuevo usuario en el sistema de recompensas"""
        metrics = UserMetrics(
            rfc=rfc,
            level=level,
            experience=0,
            consecutive_months=0,
            cfdi_count=0,
            total_fiscal_volume=0.0,
            compliance_score=0.0,
            check_in_streak=0,
            referrals_count=0,
            governance_votes=0,
            proposals_created=0,
            last_activity=datetime.now()
        )
        self.user_metrics[rfc] = metrics
        self.reward_history[rfc] = []
        self._save_data()
        return metrics
    
    def update_fiscal_metrics(self, rfc: str, cfdi_count: int, 
                              fiscal_volume: float, compliance: float):
        """Actualizar métricas fiscales desde FiscoMind"""
        if rfc not in self.user_metrics:
            self.register_user(rfc)
        
        self.user_metrics[rfc].cfdi_count = cfdi_count
        self.user_metrics[rfc].total_fiscal_volume = fiscal_volume
        self.user_metrics[rfc].compliance_score = compliance
        self.user_metrics[rfc].last_activity = datetime.now()
        self._save_data()
    
    def record_check_in(self, rfc: str):
        """Registrar check-in diario"""
        if rfc not in self.user_metrics:
            self.register_user(rfc)
        
        metrics = self.user_metrics[rfc]
        
        # Verificar streak
        last = metrics.last_activity
        today = datetime.now()
        
        if (today - last).days == 1:
            metrics.check_in_streak += 1
        elif (today - last).days > 1:
            metrics.check_in_streak = 1  # Reset
        
        metrics.last_activity = today
        self._save_data()
    
    def record_referral(self, referrer_rfc: str):
        """Registrar referido"""
        if referrer_rfc in self.user_metrics:
            self.user_metrics[referrer_rfc].referrals_count += 1
            self._save_data()
    
    def record_governance_vote(self, rfc: str):
        """Registrar voto de gobernanza"""
        if rfc in self.user_metrics:
            self.user_metrics[rfc].governance_votes += 1
            self._save_data()
    
    def record_proposal(self, rfc: str):
        """Registrar creación de propuesta"""
        if rfc in self.user_metrics:
            self.user_metrics[rfc].proposals_created += 1
            self._save_data()
    
    def calculate_fiscal_component(self, metrics: UserMetrics) -> float:
        """
        Calcular componente fiscal (40% del total)
        Base: 0.1% del volumen fiscal + bonus por compliance
        """
        # Base reward: 0.1% del volumen fiscal
        base = metrics.total_fiscal_volume * 0.001
        
        # Bonus por cantidad de CFDIs (hasta 100 CFDIs = 10% extra)
        volume_bonus = min(metrics.cfdi_count * 0.001, 0.1)
        
        # Multiplicador por compliance score
        compliance_multiplier = 1 + (metrics.compliance_score / 100)
        
        return (base + volume_bonus) * compliance_multiplier * self.WEIGHTS['fiscal']
    
    def calculate_engagement_component(self, metrics: UserMetrics) -> float:
        """
        Calcular componente de engagement (30% del total)
        Check-ins, streaks, referrals
        """
        # Base por check-ins (0.1 BZ por check-in)
        base = metrics.check_in_streak * 0.1
        
        # Bonus por streak consecutivo
        streak_bonus = min(metrics.consecutive_months * 0.5, 5.0)
        
        # Bonus por referidos (1 BZ por referido)
        referral_bonus = metrics.referrals_count * 1.0
        
        total = (base + streak_bonus + referral_bonus) * self.WEIGHTS['engagement']
        return total
    
    def calculate_governance_component(self, metrics: UserMetrics) -> float:
        """
        Calcular componente de gobernanza (20% del total)
        Votos, propuestas, participación
        """
        # Base por votos (0.5 BZ por voto)
        base = metrics.governance_votes * 0.5
        
        # Bonus por propuestas (5 BZ por propuesta)
        proposal_bonus = metrics.proposals_created * 5.0
        
        total = (base + proposal_bonus) * self.WEIGHTS['governance']
        return total
    
    def calculate_staking_component(self, metrics: UserMetrics, 
                                     staked_amount: float = 0) -> float:
        """
        Calcular componente de staking (10% del total)
        Requiere integración con contrato de staking
        """
        # Base APR 20% anual = ~0.055% diario
        daily_reward = staked_amount * 0.00055
        
        return daily_reward * self.WEIGHTS['staking']
    
    def calculate_total_rewards(self, rfc: str, 
                                staked_amount: float = 0) -> RewardCalculation:
        """
        Calcular recompensas totales con desglose
        """
        if rfc not in self.user_metrics:
            self.register_user(rfc)
        
        metrics = self.user_metrics[rfc]
        
        # Componentes
        fiscal = self.calculate_fiscal_component(metrics)
        engagement = self.calculate_engagement_component(metrics)
        governance = self.calculate_governance_component(metrics)
        staking = self.calculate_staking_component(metrics, staked_amount)
        
        base = fiscal + engagement + governance + staking
        
        # Multiplicadores
        level_mult = 1 + (metrics.level * self.LEVEL_BONUS_RATE)
        streak_mult = 1 + (metrics.consecutive_months * self.STREAK_BONUS_RATE)
        gov_mult = 1 + ((metrics.governance_votes + metrics.proposals_created * 2) 
                        * self.GOVERNANCE_BONUS_RATE)
        
        total = base * level_mult * streak_mult * gov_mult
        
        # Scores
        fiscal_score = min(int(metrics.compliance_score), 100)
        engagement_score = min(int((metrics.check_in_streak + 
                                    metrics.referrals_count * 5) * 2), 100)
        governance_score = min(int((metrics.governance_votes + 
                                    metrics.proposals_created * 10) * 5), 100)
        
        breakdown = {
            'fiscal_component': round(fiscal, 4),
            'engagement_component': round(engagement, 4),
            'governance_component': round(governance, 4),
            'staking_component': round(staking, 4),
            'base_total': round(base, 4),
            'level_bonus': round(base * (level_mult - 1), 4),
            'streak_bonus': round(base * (streak_mult - 1) * level_mult, 4),
            'governance_bonus': round(base * (gov_mult - 1) * level_mult * streak_mult, 4)
        }
        
        return RewardCalculation(
            base_reward=round(base, 2),
            level_multiplier=round(level_mult, 2),
            streak_multiplier=round(streak_mult, 2),
            governance_multiplier=round(gov_mult, 2),
            fiscal_score=fiscal_score,
            engagement_score=engagement_score,
            governance_score=governance_score,
            total_reward=round(total, 2),
            breakdown=breakdown
        )
    
    def distribute_rewards(self, rfc: str, staked_amount: float = 0) -> Dict:
        """
        Distribuir recompensas y registrar en historial
        """
        calculation = self.calculate_total_rewards(rfc, staked_amount)
        
        distribution = {
            'rfc': rfc,
            'timestamp': datetime.now().isoformat(),
            'amount': calculation.total_reward,
            'breakdown': calculation.breakdown,
            'scores': {
                'fiscal': calculation.fiscal_score,
                'engagement': calculation.engagement_score,
                'governance': calculation.governance_score
            },
            'tx_hash': self._generate_tx_hash(rfc, calculation.total_reward)
        }
        
        if rfc not in self.reward_history:
            self.reward_history[rfc] = []
        self.reward_history[rfc].append(distribution)
        
        # Resetear métricas temporales
        if rfc in self.user_metrics:
            self.user_metrics[rfc].check_in_streak = 0
            self.user_metrics[rfc].governance_votes = 0
            self.user_metrics[rfc].proposals_created = 0
        
        self._save_data()
        return distribution
    
    def _generate_tx_hash(self, rfc: str, amount: float) -> str:
        """Generar hash de transacción simulado"""
        data = f"{rfc}:{amount}:{datetime.now().isoformat()}"
        return "0x" + hashlib.sha256(data.encode()).hexdigest()[:40]
    
    def get_leaderboard(self, limit: int = 10) -> List[Dict]:
        """Obtener leaderboard de recompensas"""
        leaderboard = []
        
        for rfc, metrics in self.user_metrics.items():
            total_earned = sum(r['amount'] for r in self.reward_history.get(rfc, []))
            
            # Calcular recompensas actuales
            current = self.calculate_total_rewards(rfc)
            
            leaderboard.append({
                'rfc': rfc,
                'username': f"fisco_{rfc[-8:].lower()}",
                'level': metrics.level,
                'total_earned': round(total_earned, 2),
                'current_reward': current.total_reward,
                'fiscal_score': current.fiscal_score,
                'engagement_score': current.engagement_score,
                'governance_score': current.governance_score,
                'power': metrics.level * 10 + metrics.experience // 100
            })
        
        return sorted(leaderboard, key=lambda x: x['total_earned'], reverse=True)[:limit]
    
    def get_user_stats(self, rfc: str) -> Dict:
        """Obtener estadísticas completas de usuario"""
        if rfc not in self.user_metrics:
            return {'error': 'User not found'}
        
        metrics = self.user_metrics[rfc]
        current = self.calculate_total_rewards(rfc)
        history = self.reward_history.get(rfc, [])
        total_earned = sum(r['amount'] for r in history)
        
        return {
            'rfc': rfc,
            'username': f"fisco_{rfc[-8:].lower()}",
            'level': metrics.level,
            'experience': metrics.experience,
            'cfdi_count': metrics.cfdi_count,
            'fiscal_volume': metrics.total_fiscal_volume,
            'compliance_score': metrics.compliance_score,
            'check_in_streak': metrics.check_in_streak,
            'referrals': metrics.referrals_count,
            'governance_votes': metrics.governance_votes,
            'proposals': metrics.proposals_created,
            'current_reward': current.total_reward,
            'total_earned': round(total_earned, 2),
            'scores': {
                'fiscal': current.fiscal_score,
                'engagement': current.engagement_score,
                'governance': current.governance_score
            },
            'reward_count': len(history)
        }


# Singleton para uso global
_rewards_engine: Optional[GlobalRewardsEngine] = None


def get_rewards_engine() -> GlobalRewardsEngine:
    """Obtener instancia singleton del motor de recompensas"""
    global _rewards_engine
    if _rewards_engine is None:
        _rewards_engine = GlobalRewardsEngine()
    return _rewards_engine


# API para integración con FiscoMind
def sync_fiscal_data(rfc: str, cfdi_count: int, fiscal_volume: float, 
                     compliance: float) -> Dict:
    """Sincronizar datos fiscales desde FiscoMind"""
    engine = get_rewards_engine()
    engine.update_fiscal_metrics(rfc, cfdi_count, fiscal_volume, compliance)
    
    return {
        'status': 'synced',
        'rfc': rfc,
        'new_reward_estimate': engine.calculate_total_rewards(rfc).total_reward
    }


def calculate_user_rewards(rfc: str) -> Dict:
    """Calcular recompensas para un usuario"""
    engine = get_rewards_engine()
    calculation = engine.calculate_total_rewards(rfc)
    
    return {
        'rfc': rfc,
        'total': calculation.total_reward,
        'base': calculation.base_reward,
        'multipliers': {
            'level': calculation.level_multiplier,
            'streak': calculation.streak_multiplier,
            'governance': calculation.governance_multiplier
        },
        'scores': {
            'fiscal': calculation.fiscal_score,
            'engagement': calculation.engagement_score,
            'governance': calculation.governance_score
        },
        'breakdown': calculation.breakdown
    }


def claim_rewards(rfc: str, wallet_address: str) -> Dict:
    """Reclamar recompensas"""
    engine = get_rewards_engine()
    distribution = engine.distribute_rewards(rfc)
    
    return {
        'status': 'claimed',
        'rfc': rfc,
        'wallet': wallet_address,
        'amount': distribution['amount'],
        'tx_hash': distribution['tx_hash'],
        'timestamp': distribution['timestamp']
    }
