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
        console.warn(`CountriesNow API failed for country: ${country}, using fallback data`);
        return this.getStaticStates(country);
      }

      const result = await response.json();

      if (!result.data || !result.data.states) {
        console.warn(`No states found for ${country} from API, using fallback data`);
        return this.getStaticStates(country);
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
      return this.getStaticStates(country);
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
        console.warn(`CountriesNow API failed for country: ${country}, state: ${state}, using fallback data`);
        return this.getStaticCities(country, state);
      }

      const result = await response.json();

      if (!result.data || !Array.isArray(result.data)) {
        console.warn(`No cities found for ${state}, ${country} from API, using fallback data`);
        return this.getStaticCities(country, state);
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
      return this.getStaticCities(country, state);
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

  /**
   * Fallback static data for states when API fails
   */
  private getStaticStates(country: string) {
    const statesData: { [key: string]: string[] } = {
      'Nigeria': [
        'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
        'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Gombe', 'Imo',
        'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
        'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers',
        'Sokoto', 'Taraba', 'Yobe', 'Zamfara', 'Federal Capital Territory'
      ],
      'United States': [
        'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
        'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
        'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
        'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
        'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
        'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
        'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
        'Wisconsin', 'Wyoming'
      ],
      'United Kingdom': [
        'England', 'Scotland', 'Wales', 'Northern Ireland'
      ],
      'Canada': [
        'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador',
        'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island',
        'Quebec', 'Saskatchewan', 'Yukon'
      ],
      'India': [
        'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
        'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
        'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
        'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
        'Uttarakhand', 'West Bengal'
      ],
      'Australia': [
        'New South Wales', 'Queensland', 'South Australia', 'Tasmania', 'Victoria',
        'Western Australia', 'Australian Capital Territory', 'Northern Territory'
      ],
    };

    const states = statesData[country];

    if (states) {
      return {
        success: true,
        data: states.map(name => ({ name })),
        total: states.length,
        country,
        source: 'fallback'
      };
    }

    return {
      success: false,
      message: `No fallback data available for ${country}`,
      data: [],
    };
  }

  /**
   * Fallback static data for cities when API fails
   */
  private getStaticCities(country: string, state: string) {
    const citiesData: { [key: string]: { [key: string]: string[] } } = {
      'Nigeria': {
        'Lagos': [
          'Ikeja', 'Lekki', 'Victoria Island', 'Ikoyi', 'Surulere', 'Yaba', 'Apapa',
          'Festac Town', 'Ajah', 'Epe', 'Badagry', 'Ikorodu', 'Ojo', 'Mushin'
        ],
        'Abuja': ['Garki', 'Wuse', 'Maitama', 'Asokoro', 'Gwarinpa', 'Kubwa', 'Nyanya'],
        'Kano': ['Kano Municipal', 'Fagge', 'Dala', 'Gwale', 'Tarauni', 'Nassarawa'],
        'Rivers': ['Port Harcourt', 'Obio-Akpor', 'Eleme', 'Okrika', 'Bonny', 'Degema'],
        'Oyo': ['Ibadan', 'Ogbomosho', 'Oyo', 'Iseyin', 'Saki'],
      },
    };

    const cities = citiesData[country]?.[state];

    if (cities) {
      return {
        success: true,
        data: cities.map(name => ({ name })),
        total: cities.length,
        country,
        state,
        source: 'fallback'
      };
    }

    return {
      success: false,
      message: `No fallback data available for ${state}, ${country}`,
      data: [],
    };
  }
}
