#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Minter,
    Badge(Address),
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

    /// Set the authorized minter (the crowdfunding contract address).
    /// Only the admin can call this.
    pub fn set_minter(env: Env, minter: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        admin.require_auth();
        env.storage().instance().set(&DataKey::Minter, &minter);
    }

    /// Mint a badge for a donor. Only the authorized minter (crowdfunding contract) can call this.
    pub fn mint_badge(env: Env, donor: Address, tier: u32) {
        let minter: Address = env
            .storage()
            .instance()
            .get(&DataKey::Minter)
            .expect("Minter not set. Call set_minter first.");
        minter.require_auth();

        env.storage()
            .persistent()
            .set(&DataKey::Badge(donor.clone()), &tier);

        env.events()
            .publish((Symbol::new(&env, "badge_minted"), donor), tier);
    }

    pub fn get_badge_tier(env: Env, donor: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::Badge(donor))
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod test;
