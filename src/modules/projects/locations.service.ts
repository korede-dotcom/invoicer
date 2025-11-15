import { Injectable } from '@nestjs/common';

@Injectable()
export class LocationsService {
  /**
   * Get all countries using REST Countries API
   */
  async getCountries() {
    try {
      const response = await fetch('https://restcountries.com/v3.1/all');

      if (!response.ok) {
        console.warn('REST Countries API failed, using fallback data');
        return this.getStaticCountries();
      }

      const data = await response.json();

      const countries = data.map((country: any) => ({
        name: country.name.common,
        code: country.cca2,
        flag: country.flag,
        region: country.region,
        subregion: country.subregion,
      })).sort((a: any, b: any) => a.name.localeCompare(b.name));

      return countries;
    } catch (error) {
      console.error('Error fetching countries:', error);
      return this.getStaticCountries();
    }
  }

  /**
   * Get states/provinces for a specific country
   * Using a comprehensive list of states for major countries
   */
  async getStates(countryCode: string) {
    try {
      // Using the Country State City API (free tier)
      const response = await fetch(
        `https://api.countrystatecity.in/v1/countries/${countryCode}/states`,
        {
          headers: {
            'X-CSCAPI-KEY': process.env.COUNTRY_STATE_CITY_API_KEY || 'demo',
          },
        }
      );

      if (!response.ok) {
        // Fallback to static data for common countries
        return this.getStaticStates(countryCode);
      }

      const data = await response.json();
      return data.map((state: any) => ({
        name: state.name,
        code: state.iso2,
      }));
    } catch (error) {
      console.error('Error fetching states:', error);
      return this.getStaticStates(countryCode);
    }
  }

  /**
   * Get cities for a specific state/country
   */
  async getCities(countryCode: string, stateCode?: string) {
    try {
      let url = `https://api.countrystatecity.in/v1/countries/${countryCode}`;
      
      if (stateCode) {
        url += `/states/${stateCode}/cities`;
      } else {
        url += `/cities`;
      }

      const response = await fetch(url, {
        headers: {
          'X-CSCAPI-KEY': process.env.COUNTRY_STATE_CITY_API_KEY || 'demo',
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.map((city: any) => ({
        name: city.name,
      }));
    } catch (error) {
      console.error('Error fetching cities:', error);
      return [];
    }
  }

  /**
   * Fallback static data for common countries
   */
  private getStaticStates(countryCode: string) {
    const staticStates: Record<string, any[]> = {
      US: [
        { name: 'Alabama', code: 'AL' },
        { name: 'Alaska', code: 'AK' },
        { name: 'Arizona', code: 'AZ' },
        { name: 'Arkansas', code: 'AR' },
        { name: 'California', code: 'CA' },
        { name: 'Colorado', code: 'CO' },
        { name: 'Connecticut', code: 'CT' },
        { name: 'Delaware', code: 'DE' },
        { name: 'Florida', code: 'FL' },
        { name: 'Georgia', code: 'GA' },
        { name: 'Hawaii', code: 'HI' },
        { name: 'Idaho', code: 'ID' },
        { name: 'Illinois', code: 'IL' },
        { name: 'Indiana', code: 'IN' },
        { name: 'Iowa', code: 'IA' },
        { name: 'Kansas', code: 'KS' },
        { name: 'Kentucky', code: 'KY' },
        { name: 'Louisiana', code: 'LA' },
        { name: 'Maine', code: 'ME' },
        { name: 'Maryland', code: 'MD' },
        { name: 'Massachusetts', code: 'MA' },
        { name: 'Michigan', code: 'MI' },
        { name: 'Minnesota', code: 'MN' },
        { name: 'Mississippi', code: 'MS' },
        { name: 'Missouri', code: 'MO' },
        { name: 'Montana', code: 'MT' },
        { name: 'Nebraska', code: 'NE' },
        { name: 'Nevada', code: 'NV' },
        { name: 'New Hampshire', code: 'NH' },
        { name: 'New Jersey', code: 'NJ' },
        { name: 'New Mexico', code: 'NM' },
        { name: 'New York', code: 'NY' },
        { name: 'North Carolina', code: 'NC' },
        { name: 'North Dakota', code: 'ND' },
        { name: 'Ohio', code: 'OH' },
        { name: 'Oklahoma', code: 'OK' },
        { name: 'Oregon', code: 'OR' },
        { name: 'Pennsylvania', code: 'PA' },
        { name: 'Rhode Island', code: 'RI' },
        { name: 'South Carolina', code: 'SC' },
        { name: 'South Dakota', code: 'SD' },
        { name: 'Tennessee', code: 'TN' },
        { name: 'Texas', code: 'TX' },
        { name: 'Utah', code: 'UT' },
        { name: 'Vermont', code: 'VT' },
        { name: 'Virginia', code: 'VA' },
        { name: 'Washington', code: 'WA' },
        { name: 'West Virginia', code: 'WV' },
        { name: 'Wisconsin', code: 'WI' },
        { name: 'Wyoming', code: 'WY' },
      ],
      GB: [
        { name: 'England', code: 'ENG' },
        { name: 'Scotland', code: 'SCT' },
        { name: 'Wales', code: 'WLS' },
        { name: 'Northern Ireland', code: 'NIR' },
      ],
      CA: [
        { name: 'Alberta', code: 'AB' },
        { name: 'British Columbia', code: 'BC' },
        { name: 'Manitoba', code: 'MB' },
        { name: 'New Brunswick', code: 'NB' },
        { name: 'Newfoundland and Labrador', code: 'NL' },
        { name: 'Northwest Territories', code: 'NT' },
        { name: 'Nova Scotia', code: 'NS' },
        { name: 'Nunavut', code: 'NU' },
        { name: 'Ontario', code: 'ON' },
        { name: 'Prince Edward Island', code: 'PE' },
        { name: 'Quebec', code: 'QC' },
        { name: 'Saskatchewan', code: 'SK' },
        { name: 'Yukon', code: 'YT' },
      ],
      AU: [
        { name: 'Australian Capital Territory', code: 'ACT' },
        { name: 'New South Wales', code: 'NSW' },
        { name: 'Northern Territory', code: 'NT' },
        { name: 'Queensland', code: 'QLD' },
        { name: 'South Australia', code: 'SA' },
        { name: 'Tasmania', code: 'TAS' },
        { name: 'Victoria', code: 'VIC' },
        { name: 'Western Australia', code: 'WA' },
      ],
      IN: [
        { name: 'Andhra Pradesh', code: 'AP' },
        { name: 'Arunachal Pradesh', code: 'AR' },
        { name: 'Assam', code: 'AS' },
        { name: 'Bihar', code: 'BR' },
        { name: 'Chhattisgarh', code: 'CG' },
        { name: 'Goa', code: 'GA' },
        { name: 'Gujarat', code: 'GJ' },
        { name: 'Haryana', code: 'HR' },
        { name: 'Himachal Pradesh', code: 'HP' },
        { name: 'Jharkhand', code: 'JH' },
        { name: 'Karnataka', code: 'KA' },
        { name: 'Kerala', code: 'KL' },
        { name: 'Madhya Pradesh', code: 'MP' },
        { name: 'Maharashtra', code: 'MH' },
        { name: 'Manipur', code: 'MN' },
        { name: 'Meghalaya', code: 'ML' },
        { name: 'Mizoram', code: 'MZ' },
        { name: 'Nagaland', code: 'NL' },
        { name: 'Odisha', code: 'OR' },
        { name: 'Punjab', code: 'PB' },
        { name: 'Rajasthan', code: 'RJ' },
        { name: 'Sikkim', code: 'SK' },
        { name: 'Tamil Nadu', code: 'TN' },
        { name: 'Telangana', code: 'TS' },
        { name: 'Tripura', code: 'TR' },
        { name: 'Uttar Pradesh', code: 'UP' },
        { name: 'Uttarakhand', code: 'UK' },
        { name: 'West Bengal', code: 'WB' },
      ],
    };

    return staticStates[countryCode] || [];
  }

  /**
   * Fallback static data for countries
   */
  private getStaticCountries() {
    return [
      { name: 'Afghanistan', code: 'AF', flag: '🇦🇫', region: 'Asia', subregion: 'Southern Asia' },
      { name: 'Albania', code: 'AL', flag: '🇦🇱', region: 'Europe', subregion: 'Southern Europe' },
      { name: 'Algeria', code: 'DZ', flag: '🇩🇿', region: 'Africa', subregion: 'Northern Africa' },
      { name: 'Argentina', code: 'AR', flag: '🇦🇷', region: 'Americas', subregion: 'South America' },
      { name: 'Australia', code: 'AU', flag: '🇦🇺', region: 'Oceania', subregion: 'Australia and New Zealand' },
      { name: 'Austria', code: 'AT', flag: '🇦🇹', region: 'Europe', subregion: 'Western Europe' },
      { name: 'Belgium', code: 'BE', flag: '🇧🇪', region: 'Europe', subregion: 'Western Europe' },
      { name: 'Brazil', code: 'BR', flag: '🇧🇷', region: 'Americas', subregion: 'South America' },
      { name: 'Canada', code: 'CA', flag: '🇨🇦', region: 'Americas', subregion: 'North America' },
      { name: 'China', code: 'CN', flag: '🇨🇳', region: 'Asia', subregion: 'Eastern Asia' },
      { name: 'Denmark', code: 'DK', flag: '🇩🇰', region: 'Europe', subregion: 'Northern Europe' },
      { name: 'Egypt', code: 'EG', flag: '🇪🇬', region: 'Africa', subregion: 'Northern Africa' },
      { name: 'Finland', code: 'FI', flag: '🇫🇮', region: 'Europe', subregion: 'Northern Europe' },
      { name: 'France', code: 'FR', flag: '🇫🇷', region: 'Europe', subregion: 'Western Europe' },
      { name: 'Germany', code: 'DE', flag: '🇩🇪', region: 'Europe', subregion: 'Western Europe' },
      { name: 'Greece', code: 'GR', flag: '🇬🇷', region: 'Europe', subregion: 'Southern Europe' },
      { name: 'India', code: 'IN', flag: '🇮🇳', region: 'Asia', subregion: 'Southern Asia' },
      { name: 'Indonesia', code: 'ID', flag: '🇮🇩', region: 'Asia', subregion: 'South-Eastern Asia' },
      { name: 'Ireland', code: 'IE', flag: '🇮🇪', region: 'Europe', subregion: 'Northern Europe' },
      { name: 'Italy', code: 'IT', flag: '🇮🇹', region: 'Europe', subregion: 'Southern Europe' },
      { name: 'Japan', code: 'JP', flag: '🇯🇵', region: 'Asia', subregion: 'Eastern Asia' },
      { name: 'Mexico', code: 'MX', flag: '🇲🇽', region: 'Americas', subregion: 'North America' },
      { name: 'Netherlands', code: 'NL', flag: '🇳🇱', region: 'Europe', subregion: 'Western Europe' },
      { name: 'New Zealand', code: 'NZ', flag: '🇳🇿', region: 'Oceania', subregion: 'Australia and New Zealand' },
      { name: 'Norway', code: 'NO', flag: '🇳🇴', region: 'Europe', subregion: 'Northern Europe' },
      { name: 'Poland', code: 'PL', flag: '🇵🇱', region: 'Europe', subregion: 'Eastern Europe' },
      { name: 'Portugal', code: 'PT', flag: '🇵🇹', region: 'Europe', subregion: 'Southern Europe' },
      { name: 'Russia', code: 'RU', flag: '🇷🇺', region: 'Europe', subregion: 'Eastern Europe' },
      { name: 'Saudi Arabia', code: 'SA', flag: '🇸🇦', region: 'Asia', subregion: 'Western Asia' },
      { name: 'Singapore', code: 'SG', flag: '🇸🇬', region: 'Asia', subregion: 'South-Eastern Asia' },
      { name: 'South Africa', code: 'ZA', flag: '🇿🇦', region: 'Africa', subregion: 'Southern Africa' },
      { name: 'South Korea', code: 'KR', flag: '🇰🇷', region: 'Asia', subregion: 'Eastern Asia' },
      { name: 'Spain', code: 'ES', flag: '🇪🇸', region: 'Europe', subregion: 'Southern Europe' },
      { name: 'Sweden', code: 'SE', flag: '🇸🇪', region: 'Europe', subregion: 'Northern Europe' },
      { name: 'Switzerland', code: 'CH', flag: '🇨🇭', region: 'Europe', subregion: 'Western Europe' },
      { name: 'Thailand', code: 'TH', flag: '🇹🇭', region: 'Asia', subregion: 'South-Eastern Asia' },
      { name: 'Turkey', code: 'TR', flag: '🇹🇷', region: 'Asia', subregion: 'Western Asia' },
      { name: 'United Arab Emirates', code: 'AE', flag: '🇦🇪', region: 'Asia', subregion: 'Western Asia' },
      { name: 'United Kingdom', code: 'GB', flag: '🇬🇧', region: 'Europe', subregion: 'Northern Europe' },
      { name: 'United States', code: 'US', flag: '🇺🇸', region: 'Americas', subregion: 'North America' },
    ].sort((a, b) => a.name.localeCompare(b.name));
  }
}

