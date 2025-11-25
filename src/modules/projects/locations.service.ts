import { Injectable } from '@nestjs/common';

@Injectable()
export class LocationsService {
  /**
   * Get all countries with flags using CountriesNow API
   */
  async getCountries() {
    try {
      const response = await fetch('https://countriesnow.space/api/v0.1/countries/flag/images');

      if (!response.ok) {
        console.warn('CountriesNow API failed, using fallback data');
        return this.getStaticCountries();
      }

      const result = await response.json();

      if (!result.data || !Array.isArray(result.data)) {
        console.warn('Invalid response from CountriesNow API');
        return this.getStaticCountries();
      }

      const countries = result.data.map((country: any) => ({
        name: country.name,
        code: country.iso2,
        flag: country.flag,
      })).sort((a: any, b: any) => a.name.localeCompare(b.name));

      return {
        success: true,
        data: countries,
        total: countries.length,
      };
    } catch (error) {
      console.error('Error fetching countries:', error);
      return {
        success: true,
        data: this.getStaticCountries(),
        total: this.getStaticCountries().length,
      };
    }
  }

  /**
   * Get states/provinces for a specific country using CountriesNow API
   */
  async getStates(country: string) {
    try {
      const response = await fetch('https://countriesnow.space/api/v0.1/countries/states', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ country }),
      });

      if (!response.ok) {
        console.warn(`CountriesNow API failed for country: ${country}`);
        return {
          success: false,
          message: 'Failed to fetch states',
          data: [],
        };
      }

      const result = await response.json();

      if (!result.data || !result.data.states) {
        return {
          success: false,
          message: 'No states found for this country',
          data: [],
        };
      }

      const states = result.data.states.map((state: any) => ({
        name: typeof state === 'string' ? state : state.name,
      }));

      return {
        success: true,
        data: states,
        total: states.length,
        country: result.data.name,
      };
    } catch (error) {
      console.error('Error fetching states:', error);
      return {
        success: false,
        message: 'Error fetching states',
        data: [],
      };
    }
  }

  /**
   * Get cities for a specific state/country using CountriesNow API
   */
  async getCities(country: string, state: string) {
    try {
      const response = await fetch('https://countriesnow.space/api/v0.1/countries/state/cities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ country, state }),
      });

      if (!response.ok) {
        console.warn(`CountriesNow API failed for country: ${country}, state: ${state}`);
        return {
          success: false,
          message: 'Failed to fetch cities',
          data: [],
        };
      }

      const result = await response.json();

      if (!result.data || !Array.isArray(result.data)) {
        return {
          success: false,
          message: 'No cities found for this state',
          data: [],
        };
      }

      const cities = result.data.map((city: string) => ({
        name: city,
      }));

      return {
        success: true,
        data: cities,
        total: cities.length,
        country,
        state,
      };
    } catch (error) {
      console.error('Error fetching cities:', error);
      return {
        success: false,
        message: 'Error fetching cities',
        data: [],
      };
    }
  }

  /**
   * Fallback static data for countries
   */
  private getStaticCountries() {
    return [
      { name: 'Afghanistan', code: 'AF', flag: 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Flag_of_Afghanistan.svg' },
      { name: 'Albania', code: 'AL', flag: 'https://upload.wikimedia.org/wikipedia/commons/3/36/Flag_of_Albania.svg' },
      { name: 'Algeria', code: 'DZ', flag: 'https://upload.wikimedia.org/wikipedia/commons/7/77/Flag_of_Algeria.svg' },
      { name: 'Argentina', code: 'AR', flag: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Flag_of_Argentina.svg' },
      { name: 'Australia', code: 'AU', flag: 'https://upload.wikimedia.org/wikipedia/commons/8/88/Flag_of_Australia_%28converted%29.svg' },
      { name: 'Austria', code: 'AT', flag: 'https://upload.wikimedia.org/wikipedia/commons/4/41/Flag_of_Austria.svg' },
      { name: 'Belgium', code: 'BE', flag: 'https://upload.wikimedia.org/wikipedia/commons/6/65/Flag_of_Belgium.svg' },
      { name: 'Brazil', code: 'BR', flag: 'https://upload.wikimedia.org/wikipedia/en/0/05/Flag_of_Brazil.svg' },
      { name: 'Canada', code: 'CA', flag: 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Flag_of_Canada_%28Pantone%29.svg' },
      { name: 'China', code: 'CN', flag: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Flag_of_the_People%27s_Republic_of_China.svg' },
      { name: 'Egypt', code: 'EG', flag: 'https://upload.wikimedia.org/wikipedia/commons/f/fe/Flag_of_Egypt.svg' },
      { name: 'France', code: 'FR', flag: 'https://upload.wikimedia.org/wikipedia/en/c/c3/Flag_of_France.svg' },
      { name: 'Germany', code: 'DE', flag: 'https://upload.wikimedia.org/wikipedia/en/b/ba/Flag_of_Germany.svg' },
      { name: 'India', code: 'IN', flag: 'https://upload.wikimedia.org/wikipedia/en/4/41/Flag_of_India.svg' },
      { name: 'Italy', code: 'IT', flag: 'https://upload.wikimedia.org/wikipedia/en/0/03/Flag_of_Italy.svg' },
      { name: 'Japan', code: 'JP', flag: 'https://upload.wikimedia.org/wikipedia/en/9/9e/Flag_of_Japan.svg' },
      { name: 'Mexico', code: 'MX', flag: 'https://upload.wikimedia.org/wikipedia/commons/f/fc/Flag_of_Mexico.svg' },
      { name: 'Netherlands', code: 'NL', flag: 'https://upload.wikimedia.org/wikipedia/commons/2/20/Flag_of_the_Netherlands.svg' },
      { name: 'Nigeria', code: 'NG', flag: 'https://upload.wikimedia.org/wikipedia/commons/7/79/Flag_of_Nigeria.svg' },
      { name: 'Russia', code: 'RU', flag: 'https://upload.wikimedia.org/wikipedia/en/f/f3/Flag_of_Russia.svg' },
      { name: 'South Africa', code: 'ZA', flag: 'https://upload.wikimedia.org/wikipedia/commons/a/af/Flag_of_South_Africa.svg' },
      { name: 'Spain', code: 'ES', flag: 'https://upload.wikimedia.org/wikipedia/en/9/9a/Flag_of_Spain.svg' },
      { name: 'United Kingdom', code: 'GB', flag: 'https://upload.wikimedia.org/wikipedia/en/a/ae/Flag_of_the_United_Kingdom.svg' },
      { name: 'United States', code: 'US', flag: 'https://upload.wikimedia.org/wikipedia/en/a/a4/Flag_of_the_United_States.svg' },
    ].sort((a, b) => a.name.localeCompare(b.name));
  }
}
