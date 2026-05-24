import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { supabase } from "../services/supabaseClient";
import { User } from "@supabase/supabase-js";

export type PlanTier = 'free' | 'basic' | 'standard' | 'pro';

interface UserContextType {
  user: User | null;
  role: string;
  hasPaid: boolean; 
  planTier: PlanTier;
  tierValue: number;
  credits: number;
  setHasPaid: (status: boolean) => void;
  loading: boolean;
  markup: number;
  setMarkup: (val: number) => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string>('user');
  const [hasPaid, setHasPaid] = useState(false);
  const [planTier, setPlanTier] = useState<PlanTier>('free');
  const [credits, setCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [markup, setMarkup] = useState(0);

  const tierValue = { free: 0, basic: 1, standard: 2, pro: 3 }[planTier];

  const profilePromiseRef = useRef<Promise<void> | null>(null);
  const fetchedUserIdRef = useRef<string | null>(null);

  const fetchProfile = (userId: string): Promise<void> => {
    if (fetchedUserIdRef.current === userId) {
      return Promise.resolve();
    }
    
    if (profilePromiseRef.current) {
      return profilePromiseRef.current;
    }

    const promise = (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('has_paid, plan_tier, role, credits')
          .eq('id', userId)
          .maybeSingle(); 
        
        if (error) {
          console.error("Error fetching profile from Supabase:", error);
        }
        
        setHasPaid(data?.has_paid || false);
        setPlanTier(data?.plan_tier || (data?.has_paid ? 'pro' : 'free'));
        setRole(data?.role || 'user');
        setCredits(data?.credits || 0);
        fetchedUserIdRef.current = userId;
      } catch (err) {
        console.error("Unexpected error fetching profile:", err);
        setHasPaid(false);
        setPlanTier('free');
        setRole('user');
        setCredits(0);
      } finally {
        profilePromiseRef.current = null;
      }
    })();

    profilePromiseRef.current = promise;
    return promise;
  };

  useEffect(() => {
    let active = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;
        
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Auth initialization error in React Native:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return;
      
      try {
        const sessionUser = session?.user ?? null;
        setUser(sessionUser);

        if (sessionUser) {
          await fetchProfile(sessionUser.id);
        } else {
          fetchedUserIdRef.current = null;
          setHasPaid(false);
          setPlanTier('free');
          setRole('user');
          setCredits(0);
        }
      } catch (err) {
        console.error("onAuthStateChange error in React Native:", err);
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleManualRefresh = async () => {
    if (user) {
      fetchedUserIdRef.current = null;
      await fetchProfile(user.id);
    }
  };

  const handleSignOut = async () => {
    setUser(null);
    setHasPaid(false);
    setPlanTier('free');
    setRole('user');
    setCredits(0);
    fetchedUserIdRef.current = null;

    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error signing out from supabase:", err);
    }
  };

  return (
    <UserContext.Provider value={{ 
      user, role, hasPaid, planTier, tierValue, credits, 
      setHasPaid, loading, markup, setMarkup, 
      refreshProfile: handleManualRefresh,
      signOut: handleSignOut
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) throw new Error("useUser must be used within a UserProvider");
  return context;
};
