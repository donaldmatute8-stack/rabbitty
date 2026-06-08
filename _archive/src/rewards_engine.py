"""
Rabbitty Rewards Algorithm - Business Model Specific
Algoritmo de recompensas específico para el modelo de negocio Rabbitty
"""
from dataclasses import dataclass
from typing import Dict, List, Optional
from datetime import datetime


@dataclass
class RabbittyReward:
    """Recompensa calculada para Rabbitty SocialFi"""
    content_reward: float      # Por crear contenido
    engagement_reward: float   # Por interacciones recibidas
    referral_reward: float    # Por referir nuevos usuarios
    staking_reward: float     # Por staking de tokens
    governance_reward: float  # Por participación DAO
    total: float
    breakdown: Dict


class RabbittyRewardsEngine:
    """
    Motor de recompensas específico para Rabbitty
    
    Modelo de negocio:
    - SocialFi: Monetización de contenido e interacciones
    - NFT Identities: Identidades soulbound con XP/power
    - Token BZ: Token de utilidad y gobernanza
    - Staking: Bloqueo de tokens para beneficios
    - Referrals: Creceimiento orgánico
    
    Fuentes de ingreso:
    1. Primary: Venta de accesorios NFT
    2. Secondary: Royalties (5%) en marketplace
    3. Staking: Fees del protocolo
    4. Partnerships: Integraciones con marcas
    """
    
    # Pesos según modelo de negocio
    WEIGHTS = {
        'content_creation': 0.30,      # 30% - Crear posts, videos
        'engagement_received': 0.25,   # 25% - Likes, comments, shares
        'referrals': 0.20,             # 20% - Traer nuevos usuarios
        'staking': 0.15,               # 15% - Bloquear tokens
        'governance': 0.10,            # 10% - Votar en DAO
    }
    
    # Tasas base
    RATES = {
        'post_creation': 10.0,           # BZ por post
        'video_creation': 50.0,          # BZ por video
        'like_received': 0.1,            # BZ por like
        'comment_received': 0.5,         # BZ por comentario
        'share_received': 2.0,           # BZ por share
        'referral': 100.0,               # BZ por referido que mintea identity
        'staking_apr': 0.20,             # 20% APR
        'vote': 5.0,                     # BZ por voto
        'proposal': 50.0,                # BZ por propuesta aprobada
    }
    
    def __init__(self):
        self.user_activity: Dict[str, Dict] = {}
    
    def calculate_content_reward(self, posts: int = 0, videos: int = 0) -> float:
        """Calcular recompensa por creación de contenido"""
        return (posts * self.RATES['post_creation'] + 
                videos * self.RATES['video_creation'])
    
    def calculate_engagement_reward(self, likes: int = 0, 
                                    comments: int = 0, 
                                    shares: int = 0) -> float:
        """Calcular recompensa por engagement recibido"""
        return (likes * self.RATES['like_received'] +
                comments * self.RATES['comment_received'] +
                shares * self.RATES['share_received'])
    
    def calculate_referral_reward(self, successful_refs: int) -> float:
        """Calcular recompensa por referidos"""
        return successful_refs * self.RATES['referral']
    
    def calculate_staking_reward(self, staked_amount: float, 
                                  days: int) -> float:
        """Calcular recompensa por staking"""
        daily_rate = self.RATES['staking_apr'] / 365
        return staked_amount * daily_rate * days
    
    def calculate_governance_reward(self, votes: int = 0, 
                                     proposals: int = 0) -> float:
        """Calcular recompensa por participación DAO"""
        return (votes * self.RATES['vote'] +
                proposals * self.RATES['proposal'])
    
    def calculate_total(self, 
                       posts: int = 0,
                       videos: int = 0,
                       likes: int = 0,
                       comments: int = 0,
                       shares: int = 0,
                       referrals: int = 0,
                       staked: float = 0.0,
                       stake_days: int = 0,
                       votes: int = 0,
                       proposals: int = 0,
                       level: int = 1) -> RabbittyReward:
        """Calcular recompensas totales"""
        
        # Calcular componentes
        content = self.calculate_content_reward(posts, videos)
        engagement = self.calculate_engagement_reward(likes, comments, shares)
        referral = self.calculate_referral_reward(referrals)
        staking = self.calculate_staking_reward(staked, stake_days)
        governance = self.calculate_governance_reward(votes, proposals)
        
        # Multiplicador por nivel
        level_mult = 1 + (level - 1) * 0.05  # +5% por nivel
        
        # Aplicar pesos
        weighted_content = content * self.WEIGHTS['content_creation']
        weighted_engagement = engagement * self.WEIGHTS['engagement_received']
        weighted_referral = referral * self.WEIGHTS['referrals']
        weighted_staking = staking * self.WEIGHTS['staking']
        weighted_gov = governance * self.WEIGHTS['governance']
        
        # Total con multiplicador de nivel
        total = (weighted_content + weighted_engagement + 
                weighted_referral + weighted_staking + 
                weighted_gov) * level_mult
        
        return RabbittyReward(
            content_reward=round(weighted_content, 2),
            engagement_reward=round(weighted_engagement, 2),
            referral_reward=round(weighted_referral, 2),
            staking_reward=round(weighted_staking, 2),
            governance_reward=round(weighted_gov, 2),
            total=round(total, 2),
            breakdown={
                'content': round(content, 2),
                'engagement': round(engagement, 2),
                'referral': round(referral, 2),
                'staking': round(staking, 2),
                'governance': round(governance, 2),
                'level_multiplier': round(level_mult, 2)
            }
        )
    
    def get_business_summary(self) -> str:
        """Resumen del modelo de negocio"""
        return """
🐰 **Rabbitty Business Model**

**Revenue Streams:**
1. **Primary Sales** (40%): NFT accessories, premium features
2. **Secondary Royalties** (25%): 5% on marketplace transactions  
3. **Protocol Fees** (20%): Staking fees, swaps
4. **B2B Partnerships** (15%): Brand integrations, sponsored content

**Token Utility (BZ):**
• Rewards for content creators
• Staking for governance rights
• Accessory purchases
• Fee discounts

**Growth Flywheel:**
1. Create content → Earn BZ
2. Stake BZ → Governance + More rewards
3. Buy accessories → Identity upgrades
4. Refer friends → Both earn
5. Marketplace trades → Royalties → Treasury

**Current Phase:** Testnet deployment
**Next:** Mainnet launch + Token generation event
"""


# Instancia global
rabbitty_engine = RabbittyRewardsEngine()
