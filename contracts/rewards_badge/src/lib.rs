#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Badge(Address),
    CrowdfundingContract,
}

#[contract]
pub struct RewardsBadgeContract;

#[contractimpl]
impl RewardsBadgeContract {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn set_crowdfunding_contract(env: Env, crowdfunding: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("Not initialized");
        admin.require_auth();
        env.storage().instance().set(&DataKey::CrowdfundingContract, &crowdfunding);
    }

    pub fn set_minter(env: Env, minter: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("Not initialized");
        admin.require_auth();
        env.storage().instance().set(&DataKey::CrowdfundingContract, &minter);
    }

    pub fn mint_badge(env: Env, donor: Address, tier: u32) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("Not initialized");
        
        if let Some(cf) = env.storage().instance().get::<_, Address>(&DataKey::CrowdfundingContract) {
            cf.require_auth();
        } else {
            admin.require_auth();
        }

        env.storage().persistent().set(&DataKey::Badge(donor.clone()), &tier);

        env.events().publish(
            (Symbol::new(&env, "badge_minted"), donor),
            tier
        );
    }

    pub fn get_badge_tier(env: Env, donor: Address) -> u32 {
        env.storage().persistent().get(&DataKey::Badge(donor)).unwrap_or(0)
    }
}

#[cfg(test)]
mod test;
// Rewards badge core contract
