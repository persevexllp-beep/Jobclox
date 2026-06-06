/**
 * User Service Layer
 * Provides abstraction for user data operations
 * Supports both Supabase and JSON backends via feature flag
 */

import { User } from '../src/types'
import { supabaseAdmin } from '../lib/supabase'

/**
 * Feature flag: Set to true to use Supabase, false to use JSON
 * This allows safe rollback during migration testing
 */
export const USE_SUPABASE_USERS = true

/**
 * Reference to the in-memory database (when using JSON backend)
 * This will be injected by server.ts to avoid circular dependencies
 */
let jsonDB: { users: User[] } | null = null

export function setJsonDB(db: { users: User[] }): void {
  jsonDB = db
}

export class UserService {
  /**
   * Get user by ID
   */
  static async getUserById(id: string): Promise<User | null> {
    if (USE_SUPABASE_USERS) {
      try {
        const { data, error } = await supabaseAdmin!
          .from('users')
          .select('*')
          .eq('id', id)
          .single()

        if (error || !data) {
          console.debug(`[Supabase] User not found: ${id}`)
          return null
        }

        // Map Supabase column names to User interface
        return this.mapSupabaseToUser(data)
      } catch (err) {
        console.error('[UserService] Error fetching user by ID:', err)
        throw err
      }
    } else {
      // JSON backend
      if (!jsonDB) throw new Error('JSON DB not initialized')
      return jsonDB.users.find(u => u.id === id) || null
    }
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email: string): Promise<User | null> {
    const lowerEmail = email.toLowerCase()

    if (USE_SUPABASE_USERS) {
      try {
        const { data, error } = await supabaseAdmin!
          .from('users')
          .select('*')
          .ilike('email', lowerEmail)
          .single()

        if (error) {
          // No rows found is not an error, just return null
          if (error.code === 'PGRST116') {
            console.debug(`[Supabase] User not found: ${email}`)
            return null
          }
          throw error
        }

        if (!data) {
          console.debug(`[Supabase] User not found: ${email}`)
          return null
        }

        return this.mapSupabaseToUser(data)
      } catch (err: any) {
        // Handle case where multiple users found (should not happen with unique constraint)
        if (err.message?.includes('multiple rows') || err.code === 'PGRST110') {
          console.error('[UserService] Multiple users found with same email:', email)
          // Return the first match
          const { data } = await supabaseAdmin!
            .from('users')
            .select('*')
            .ilike('email', lowerEmail)
            .limit(1)

          if (data && data.length > 0) {
            return this.mapSupabaseToUser(data[0])
          }
          return null
        }
        console.error('[UserService] Error fetching user by email:', err)
        throw err
      }
    } else {
      // JSON backend
      if (!jsonDB) throw new Error('JSON DB not initialized')
      return jsonDB.users.find(u => u.email.toLowerCase() === lowerEmail) || null
    }
  }

  /**
   * Check if user with email exists
   */
  static async userEmailExists(email: string): Promise<boolean> {
    const user = await this.getUserByEmail(email)
    return user !== null
  }

  /**
   * Create a new user
   */
  static async createUser(userData: Omit<User, 'createdAt'>): Promise<User> {
    if (USE_SUPABASE_USERS) {
      try {
        const { data, error } = await supabaseAdmin!
          .from('users')
          .insert({
            id: userData.id,
            name: userData.name,
            email: userData.email,
            role: userData.role,
            status: userData.status,
            created_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (error) {
          console.error('[UserService] Error creating user:', error)
          throw error
        }

        if (!data) {
          throw new Error('No data returned from insert')
        }

        return this.mapSupabaseToUser(data)
      } catch (err) {
        console.error('[UserService] Exception creating user:', err)
        throw err
      }
    } else {
      // JSON backend
      if (!jsonDB) throw new Error('JSON DB not initialized')
      const newUser: User = {
        ...userData,
        createdAt: new Date().toISOString(),
      }
      jsonDB.users.push(newUser)
      return newUser
    }
  }

  /**
   * Update a user
   */
  static async updateUser(
    id: string,
    updates: Partial<Omit<User, 'id' | 'createdAt'>>
  ): Promise<User | null> {
    if (USE_SUPABASE_USERS) {
      try {
        const updateData: Record<string, any> = {}

        if (updates.name !== undefined) updateData.name = updates.name
        if (updates.email !== undefined) updateData.email = updates.email
        if (updates.role !== undefined) updateData.role = updates.role
        if (updates.status !== undefined) updateData.status = updates.status

        if (Object.keys(updateData).length === 0) {
          // No updates to make, just return the user
          return this.getUserById(id)
        }

        const { data, error } = await supabaseAdmin!
          .from('users')
          .update(updateData)
          .eq('id', id)
          .select()
          .single()

        if (error) {
          console.error('[UserService] Error updating user:', error)
          throw error
        }

        if (!data) {
          return null
        }

        return this.mapSupabaseToUser(data)
      } catch (err) {
        console.error('[UserService] Exception updating user:', err)
        throw err
      }
    } else {
      // JSON backend
      if (!jsonDB) throw new Error('JSON DB not initialized')
      const userIndex = jsonDB.users.findIndex(u => u.id === id)
      if (userIndex === -1) return null

      jsonDB.users[userIndex] = {
        ...jsonDB.users[userIndex],
        ...updates,
      }
      return jsonDB.users[userIndex]
    }
  }

  /**
   * Get all users
   */
  static async getAllUsers(): Promise<User[]> {
    if (USE_SUPABASE_USERS) {
      try {
        const { data, error } = await supabaseAdmin!
          .from('users')
          .select('*')

        if (error) {
          console.error('[UserService] Error fetching all users:', error)
          throw error
        }

        if (!data) {
          return []
        }

        return data.map(row => this.mapSupabaseToUser(row))
      } catch (err) {
        console.error('[UserService] Exception fetching all users:', err)
        throw err
      }
    } else {
      // JSON backend
      if (!jsonDB) throw new Error('JSON DB not initialized')
      return [...jsonDB.users]
    }
  }

  /**
   * Map Supabase row to User interface
   * Handles column name differences (created_at vs createdAt)
   */
  private static mapSupabaseToUser(row: any): User {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
      createdAt: row.created_at || new Date().toISOString(),
    }
  }

  /**
   * Debug helper: Show which backend is active
   */
  static getBackendInfo(): { backend: string; supabaseEnabled: boolean } {
    return {
      backend: USE_SUPABASE_USERS ? 'Supabase' : 'JSON',
      supabaseEnabled: USE_SUPABASE_USERS,
    }
  }
}
